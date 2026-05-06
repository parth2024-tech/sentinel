import { Router } from "express";
import Stripe from "stripe";
import { db, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import express from "express";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock", {
  apiVersion: "2026-04-22.dahlia" as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock";

// Webhooks need raw body for signature verification
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    res.status(400).send("Webhook Error: Missing stripe-signature header");
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    req.log.error({ err }, "Webhook signature verification failed");
    // During local dev without proper keys, we might mock processing anyway
    if (process.env.NODE_ENV === "development" && !process.env.STRIPE_SECRET_KEY) {
      req.log.warn("Mocking stripe webhook processing due to missing keys in dev");
      event = JSON.parse(req.body.toString());
    } else {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // In a real flow, client_reference_id would contain the orgId
        const orgId = session.client_reference_id;
        
        if (orgId) {
          await db.update(organizationsTable)
            .set({ 
              status: "active",
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string 
            })
            .where(eq(organizationsTable.id, orgId));
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await db.update(organizationsTable)
          .set({ 
            status: subscription.status,
            currentPeriodEnd: new Date(((subscription as any).current_period_end || (subscription as any).currentPeriodEnd) * 1000)
          })
          .where(eq(organizationsTable.stripeSubscriptionId, subscription.id));
        break;
      }
      default:
        req.log.info(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "Failed to process webhook");
    res.status(500).send("Internal Server Error");
  }
});

export default router;
