import { Router } from "express";
import crypto from "node:crypto";
import {
  db,
  organizationsTable,
  usersTable,
  organizationMembersTable,
  myReportsSessionsTable,
} from "@workspace/db";
import { CreateOrganizationBody, CreateStripeCheckoutSessionBody } from "@workspace/api-zod";
import { eq, and, gt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { requireTenantAuth, type TenantRequest } from "../middlewares/tenantAuth.js";

const router = Router();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ── POST /api/organizations ───────────────────────────────────────────────────
// Creates a new organization for an authenticated user session.
router.post("/", async (req, res) => {
  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { name } = parsed.data;

  // Resolve authenticated user from session
  const cookies = req.cookies as Record<string, string> | undefined;
  const sessionToken = cookies?.["__Host-sentinel_session"] || cookies?.["sentinel_session"];

  if (!sessionToken || sessionToken.length < 16) {
    res.status(401).json({ error: "Authentication required to create an organization." });
    return;
  }

  try {
    const sessionHash = hashToken(sessionToken);
    const now = new Date();

    const sessionRows = await db
      .select()
      .from(myReportsSessionsTable)
      .where(
        and(
          eq(myReportsSessionsTable.token, sessionHash),
          gt(myReportsSessionsTable.expiresAt, now)
        )
      )
      .limit(1);

    const session = sessionRows[0];
    if (!session) {
      res.status(401).json({ error: "Session expired or invalid." });
      return;
    }

    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, session.email))
      .limit(1);

    let userId = userRows[0]?.id;
    if (!userId) {
      const newUserId = createId();
      await db.insert(usersTable).values({
        id: newUserId,
        email: session.email,
        name: session.email.split("@")[0] || "User",
      });
      userId = newUserId;
    }

    const orgId = createId();
    const apiKey = `sentinel_org_${crypto.randomBytes(24).toString("hex")}`;
    const apiKeyHash = hashToken(apiKey);

    await db.insert(organizationsTable).values({
      id: orgId,
      name,
      ownerId: userId,
      apiKeyHash,
      status: "active",
    });

    await db.insert(organizationMembersTable).values({
      orgId,
      userId,
      role: "owner",
    });

    res.status(201).json({
      id: orgId,
      name,
      ownerId: userId,
      apiKey,
      status: "active",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create organization");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

// ── POST /api/organizations/:orgId/checkout-session ───────────────────────────
router.post("/:orgId/checkout-session", requireTenantAuth, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { orgId } = tenantReq.params;

  if (tenantReq.tenant.orgId !== orgId && tenantReq.tenant.role !== "owner" && tenantReq.tenant.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Cannot initiate billing checkout for another organization." });
    return;
  }

  const parsed = CreateStripeCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { successUrl } = parsed.data;

  try {
    const org = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, tenantReq.tenant.orgId))
      .limit(1);

    if (org.length === 0) {
      res.status(404).json({ error: "Organization not found", details: "" });
      return;
    }

    res.status(200).json({
      sessionId: `cs_test_${createId()}`,
      url: successUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

// ── GET /api/organizations/:orgId/billing ─────────────────────────────────────
router.get("/:orgId/billing", requireTenantAuth, async (req, res) => {
  const tenantReq = req as TenantRequest;
  const { orgId } = tenantReq.params;

  if (tenantReq.tenant.orgId !== orgId) {
    res.status(403).json({ error: "Forbidden: Cross-tenant organization access denied." });
    return;
  }

  try {
    const org = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, tenantReq.tenant.orgId))
      .limit(1);

    const orgRow = org[0];
    if (!orgRow) {
      res.status(404).json({ error: "Organization not found", details: "" });
      return;
    }

    res.status(200).json({
      status: orgRow.status,
      currentPeriodEnd: orgRow.currentPeriodEnd?.toISOString() || null,
      portalUrl: "https://billing.stripe.com/p/session/test_mock",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get billing status");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

export default router;
