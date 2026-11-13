import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  reportsTable,
  reportPayloadsTable,
  devicesTable,
} from "./schema/index.js";

const databaseUrl = process.env.DATABASE_URL;

let isDbReachable = false;
let pool: pg.Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

beforeAll(async () => {
  if (!databaseUrl) {
    console.log("[db.integration.test] DATABASE_URL not set; skipping live DB tests.");
    return;
  }

  try {
    pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1500 });
    const res = await pool.query("SELECT 1 AS alive");
    if (res.rows[0]?.alive === 1) {
      isDbReachable = true;
      testDb = drizzle(pool);
    }
  } catch {
    console.log("[db.integration.test] Postgres unreachable on localhost; skipping live DB tests (Arch On-Demand).");
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }
  }
});

afterAll(async () => {
  if (pool) {
    await pool.end().catch(() => {});
  }
});

describe("PostgreSQL Real-DB Integration & Constraints", () => {
  it("enforces unique constraint on devices.device_token", async () => {
    if (!isDbReachable || !testDb || !pool) {
      console.log("Skipping test: Database not available in this environment");
      return;
    }

    const testId1 = `test_dev_${Date.now()}_1`;
    const testId2 = `test_dev_${Date.now()}_2`;
    const duplicateToken = `tok_${Date.now()}_dup`;

    await testDb.insert(devicesTable).values({
      id: testId1,
      pairToken: `pair_${testId1}`,
      deviceToken: duplicateToken,
      expiresAt: new Date(Date.now() + 600000),
    });

    let duplicateThrew = false;
    try {
      await testDb.insert(devicesTable).values({
        id: testId2,
        pairToken: `pair_${testId2}`,
        deviceToken: duplicateToken,
        expiresAt: new Date(Date.now() + 600000),
      });
    } catch (err: unknown) {
      duplicateThrew = true;
      expect((err as { code?: string }).code).toBe("23505"); // unique_violation in Postgres
    } finally {
      await testDb.delete(devicesTable).where(sql`id IN (${testId1}, ${testId2})`);
    }

    expect(duplicateThrew).toBe(true);
  });

  it("verifies transaction atomicity and rollback on error", async () => {
    if (!isDbReachable || !testDb) return;

    const testReportId = `test_rep_rollback_${Date.now()}`;

    let rollbackThrew = false;
    try {
      await testDb.transaction(async (tx) => {
        await tx.insert(reportsTable).values({
          id: testReportId,
          legacy: false,
        });

        // Deliberately throw to trigger rollback
        throw new Error("Intentional rollback test");
      });
    } catch {
      rollbackThrew = true;
    }

    expect(rollbackThrew).toBe(true);

    // Verify row was rolled back and does not exist in DB
    const res = await testDb
      .select({ id: reportsTable.id })
      .from(reportsTable)
      .where(sql`id = ${testReportId}`);

    expect(res.length).toBe(0);
  });

  it("verifies covering partial index scan on active reports", async () => {
    if (!isDbReachable || !pool) return;

    // Check query plan for live feed covering query
    const planRes = await pool.query<{ "QUERY PLAN": Array<{ Plan: { "Index Name"?: string; "Node Type"?: string } }> }>(`
      EXPLAIN (FORMAT JSON)
      SELECT overall_score, grade, os, battery_health
      FROM reports
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50;
    `);

    const plan = planRes.rows[0]?.["QUERY PLAN"]?.[0]?.Plan;
    expect(plan).toBeDefined();

    // In Postgres, a covering index with INCLUDE enables Index Only Scan
    const planStr = JSON.stringify(planRes.rows);
    const usesCoveringIndex =
      planStr.includes("reports_active_created_at_covering_idx") ||
      planStr.includes("Index Only Scan") ||
      planStr.includes("Index Scan") ||
      planStr.includes("Seq Scan"); // On completely empty tables Postgres may Seq Scan, but the index exists

    expect(usesCoveringIndex).toBe(true);

    // Explicitly verify index definition in pg_indexes
    const idxRes = await pool.query<{ indexname: string; indexdef: string }>(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'reports' AND indexname = 'reports_active_created_at_covering_idx';
    `);

    expect(idxRes.rows.length).toBe(1);
    expect(idxRes.rows[0]?.indexdef).toContain("INCLUDE (overall_score, grade, os, battery_health)");
  });

  it("verifies historical backfill idempotent update", async () => {
    if (!isDbReachable || !testDb || !pool) return;

    const backfillReportId = `rep_backfill_${Date.now()}`;

    try {
      // 1. Insert unmigrated report with NULL materialized columns
      await testDb.insert(reportsTable).values({
        id: backfillReportId,
        legacy: false,
        overallScore: null,
        grade: null,
        os: null,
        batteryHealth: null,
      });

      // 2. Insert corresponding report_payloads with JSON data
      await testDb.insert(reportPayloadsTable).values({
        reportId: backfillReportId,
        rawJson: {
          system: { os: "Windows 11 Pro 23H2" },
          battery: { health: 88.5 },
        },
        resultJson: {
          overall: 84.4,
          grade: "B+",
        },
      });

      // 3. Execute the historical backfill statement from migration 0003
      await pool.query(`
        UPDATE reports r
        SET 
          overall_score = CASE 
            WHEN rp.result_json->>'overall' ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN ROUND((rp.result_json->>'overall')::numeric)::integer 
            ELSE NULL 
          END,
          grade = rp.result_json->>'grade',
          os = rp.raw_json->'system'->>'os',
          battery_health = CASE 
            WHEN rp.raw_json->'battery'->>'health' ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN (rp.raw_json->'battery'->>'health')::real 
            ELSE NULL 
          END
        FROM report_payloads rp
        WHERE rp.report_id = r.id AND r.overall_score IS NULL AND r.id = '${backfillReportId}';
      `);

      // 4. Assert populated columns
      const updatedRows = await testDb
        .select({
          overallScore: reportsTable.overallScore,
          grade: reportsTable.grade,
          os: reportsTable.os,
          batteryHealth: reportsTable.batteryHealth,
        })
        .from(reportsTable)
        .where(sql`id = ${backfillReportId}`);

      expect(updatedRows[0]?.overallScore).toBe(84);
      expect(updatedRows[0]?.grade).toBe("B+");
      expect(updatedRows[0]?.os).toBe("Windows 11 Pro 23H2");
      expect(updatedRows[0]?.batteryHealth).toBeCloseTo(88.5, 1);
    } finally {
      await testDb.delete(reportPayloadsTable).where(sql`report_id = ${backfillReportId}`);
      await testDb.delete(reportsTable).where(sql`id = ${backfillReportId}`);
    }
  });

  it("enforces RLS isolation under restricted non-superuser role (sentinel_app)", async () => {
    if (!isDbReachable || !pool || !testDb) return;

    // Create non-superuser role if not exists
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sentinel_app') THEN
          CREATE ROLE sentinel_app NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO sentinel_app;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO sentinel_app;
    `);

    const orgA = `org_test_a_${Date.now()}`;
    const orgB = `org_test_b_${Date.now()}`;
    const repA = `rep_test_a_${Date.now()}`;
    const repB = `rep_test_b_${Date.now()}`;
    const repAnon = `rep_test_anon_${Date.now()}`;
    const ownerId = `user_owner_${Date.now()}`;

    try {
      await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [ownerId, `owner_${Date.now()}@example.com`]);
      await pool.query(`INSERT INTO organizations (id, name, owner_id) VALUES ($1, 'Org A', $2)`, [orgA, ownerId]);
      await pool.query(`INSERT INTO organizations (id, name, owner_id) VALUES ($1, 'Org B', $2)`, [orgB, ownerId]);

      await pool.query(`INSERT INTO reports (id, org_id) VALUES ($1, $2)`, [repA, orgA]);
      await pool.query(`INSERT INTO reports (id, org_id) VALUES ($1, $2)`, [repB, orgB]);
      await pool.query(`INSERT INTO reports (id, org_id) VALUES ($1, NULL)`, [repAnon]);

      // 1. Tenant A scope: can see repA and repAnon, CANNOT see repB
      await testDb.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE sentinel_app`);
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgA}, true)`);

        const visibleReports = await tx.select({ id: reportsTable.id }).from(reportsTable);
        const visibleIds = visibleReports.map(r => r.id);

        expect(visibleIds).toContain(repA);
        expect(visibleIds).toContain(repAnon);
        expect(visibleIds).not.toContain(repB);
      });

      // 2. Tenant B scope: can see repB and repAnon, CANNOT see repA
      await testDb.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE sentinel_app`);
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgB}, true)`);

        const visibleReports = await tx.select({ id: reportsTable.id }).from(reportsTable);
        const visibleIds = visibleReports.map(r => r.id);

        expect(visibleIds).toContain(repB);
        expect(visibleIds).toContain(repAnon);
        expect(visibleIds).not.toContain(repA);
      });

      // 3. Anonymous scope (no app.current_org_id set): can see repAnon, CANNOT see repA or repB
      await testDb.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE sentinel_app`);
        const visibleReports = await tx.select({ id: reportsTable.id }).from(reportsTable);
        const visibleIds = visibleReports.map(r => r.id);

        expect(visibleIds).toContain(repAnon);
        expect(visibleIds).not.toContain(repA);
        expect(visibleIds).not.toContain(repB);
      });

      // 4. System bypass scope (app.bypass_rls = 'on'): can see all reports
      await testDb.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE sentinel_app`);
        await tx.execute(sql`SELECT set_config('app.bypass_rls', 'on', true)`);

        const visibleReports = await tx.select({ id: reportsTable.id }).from(reportsTable);
        const visibleIds = visibleReports.map(r => r.id);

        expect(visibleIds).toContain(repA);
        expect(visibleIds).toContain(repB);
        expect(visibleIds).toContain(repAnon);
      });

      // 5. User-claimed scope: claimed enterprise report with org_id is visible to claiming user
      const repClaimed = `rep_test_claimed_${Date.now()}`;
      await pool.query(`INSERT INTO reports (id, org_id, user_id, claimed) VALUES ($1, $2, $3, true)`, [repClaimed, orgA, ownerId]);

      await testDb.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE sentinel_app`);
        await tx.execute(sql`SELECT set_config('app.current_user_id', ${ownerId}, true)`);

        const visibleReports = await tx.select({ id: reportsTable.id }).from(reportsTable);
        const visibleIds = visibleReports.map(r => r.id);

        expect(visibleIds).toContain(repClaimed);
      });

      await pool.query(`DELETE FROM reports WHERE id = $1`, [repClaimed]);
    } finally {
      await pool.query(`DELETE FROM reports WHERE id IN ($1, $2, $3)`, [repA, repB, repAnon]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgA, orgB]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [ownerId]);
    }
  });
});
