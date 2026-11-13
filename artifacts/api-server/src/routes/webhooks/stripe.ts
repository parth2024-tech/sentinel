/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import Stripe from "stripe";
import { db, organizationsTable, idempotencyKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {
  apiVersion: "2026-04-22.dahlia" as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock";

// Webhooks require the exact raw bytes for cryptographic signature verification
router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig || typeof sig !== "string") {
    res.status(400).send("Webhook Error: Missing stripe-signature header");
    return;
  }

  // Capture wire buffer from req.rawBody (populated by app.ts verify hook) or fallback
  const rawBodyBuf =
    (req as any).rawBody ||
    (Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body)));

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBodyBuf, sig, endpointSecret);
  } catch (err: any) {
    req.log.error({ err }, "Webhook signature verification failed");
    // During local dev without proper keys, mock processing if explicitly configured
    if (process.env.NODE_ENV === "development" && !process.env.STRIPE_SECRET_KEY) {
      req.log.warn("Mocking stripe webhook processing due to missing keys in dev");
      try {
        event = JSON.parse(rawBodyBuf.toString("utf8"));
      } catch {
        res.status(400).send("Invalid JSON payload");
        return;
      }
    } else {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  }

  try {
    const idempotencyKey = `stripe:${event.id}`;
    const eventTimestamp = new Date((event.created || Math.floor(Date.now() / 1000)) * 1000);

    await db.transaction(async (tx) => {
      // 1. Idempotency check: record event.id in idempotency_keys
      const inserted = await tx
        .insert(idempotencyKeysTable)
        .values({ key: idempotencyKey, reportId: "stripe_webhook" })
        .onConflictDoNothing()
        .returning({ key: idempotencyKeysTable.key });

      if (inserted.length === 0) {
        req.log.info({ eventId: event.id }, "stripe_webhook_duplicate_skipped");
        return;
      }

      // 2. Process event with out-of-order delivery protection
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const orgId = session.client_reference_id;

          if (orgId) {
            const orgs = await tx
              .select()
              .from(organizationsTable)
              .where(eq(organizationsTable.id, orgId))
              .limit(1);

            const org = orgs[0];
            if (!org?.stripeUpdatedAt || org.stripeUpdatedAt <= eventTimestamp) {
              await tx
                .update(organizationsTable)
                .set({
                  status: "active",
                  stripeSubscriptionId: session.subscription as string,
                  stripeCustomerId: session.customer as string,
                  stripeUpdatedAt: eventTimestamp,
                  updatedAt: new Date(),
                })
                .where(eq(organizationsTable.id, orgId));
            } else {
              req.log.warn({ eventId: event.id, orgId }, "stripe_webhook_stale_skipped");
            }
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const orgs = await tx
            .select()
            .from(organizationsTable)
            .where(eq(organizationsTable.stripeSubscriptionId, subscription.id))
            .limit(1);

          const org = orgs[0];
          if (org) {
            if (!org.stripeUpdatedAt || org.stripeUpdatedAt <= eventTimestamp) {
              await tx
                .update(organizationsTable)
                .set({
                  status: subscription.status,
                  currentPeriodEnd: new Date(
                    ((subscription as any).current_period_end || (subscription as any).currentPeriodEnd) * 1000
                  ),
                  stripeUpdatedAt: eventTimestamp,
                  updatedAt: new Date(),
                })
                .where(eq(organizationsTable.id, org.id));
            } else {
              req.log.warn({ eventId: event.id, orgId: org.id }, "stripe_webhook_stale_skipped");
            }
          }
          break;
        }
        default:
          req.log.info(`Unhandled event type ${event.type}`);
      }
    });

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Failed to process webhook");
    res.status(500).send("Internal Server Error");
  }
});

export default router;
