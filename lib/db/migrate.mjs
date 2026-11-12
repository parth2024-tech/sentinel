import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not defined in environment.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Ensure migrations ledger exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _sentinel_migrations (
        name TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const appliedRes = await client.query(`SELECT name FROM _sentinel_migrations`);
    const appliedSet = new Set(appliedRes.rows.map((r) => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[migrate] Skip already applied: ${file}`);
        continue;
      }

      console.log(`[migrate] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sqlContent);
        await client.query(
          `INSERT INTO _sentinel_migrations (name) VALUES ($1)`,
          [file]
        );
        await client.query("COMMIT");
        console.log(`[migrate] Successfully applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate] Failed applying ${file}:`, err);
        throw err;
      }
    }

    console.log("[migrate] All migrations up to date.");

    // Update Visibility Map (VM) and planner statistics so covering indexes enable 100% Index-Only Scans
    try {
      console.log("[migrate] Running VACUUM ANALYZE reports to populate Visibility Map...");
      await client.query("VACUUM ANALYZE reports;");
      console.log("[migrate] VACUUM ANALYZE reports completed.");
    } catch (vacuumErr) {
      console.warn("[migrate] VACUUM ANALYZE warning (non-fatal):", vacuumErr);
    }
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error("[migrate] Fatal migration error:", err);
  process.exit(1);
});
