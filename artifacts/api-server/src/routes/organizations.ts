import { Router } from "express";
import { db, organizationsTable, usersTable } from "@workspace/db";
import { CreateOrganizationBody, CreateStripeCheckoutSessionBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

// Minimal implementation, in a real SaaS you would extract user ID from auth middleware
// For this phase, we assume basic org creation
router.post("/", async (req, res) => {
  const parsed = CreateOrganizationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { name } = parsed.data;

  try {
    // In a real app we'd get ownerId from session, here we'll just mock or require an existing owner.
    // For simplicity of phase 1, we just create the org with a dummy owner if needed,
    // or fail if we don't have one. Let's just create a dummy owner if none exist for test purposes.
    const owner = await db.select().from(usersTable).limit(1);
    let ownerId = owner[0]?.id;

    if (!ownerId) {
      ownerId = createId();
      await db.insert(usersTable).values({
        id: ownerId,
        email: `dummy-${ownerId}@example.com`,
        name: "Dummy Owner"
      });
    }

    const orgId = createId();
    await db.insert(organizationsTable).values({
      id: orgId,
      name,
      ownerId,
      status: "active"
    });

    res.status(201).json({
      id: orgId,
      name,
      ownerId,
      status: "active"
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create organization");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

router.post("/:orgId/checkout-session", async (req, res) => {
  const parsed = CreateStripeCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { priceId, successUrl, cancelUrl } = parsed.data;
  const { orgId } = req.params;

  try {
    const org = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    if (org.length === 0) {
      res.status(404).json({ error: "Organization not found", details: "" });
      return;
    }

    // Since we don't have Stripe keys, mock the response
    res.status(200).json({
      sessionId: `cs_test_${createId()}`,
      url: successUrl
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

router.get("/:orgId/billing", async (req, res) => {
  const { orgId } = req.params;

  try {
    const org = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    if (org.length === 0) {
      res.status(404).json({ error: "Organization not found", details: "" });
      return;
    }

    res.status(200).json({
      status: org[0].status,
      currentPeriodEnd: org[0].currentPeriodEnd?.toISOString() || null,
      portalUrl: "https://billing.stripe.com/p/session/test_mock"
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get billing status");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

export default router;
