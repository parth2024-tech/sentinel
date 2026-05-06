import { Router } from "express";
import { db, waitlistTable } from "@workspace/db";
import { JoinWaitlistBody } from "@workspace/api-zod";
import { eq, count } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  const parsed = JoinWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { email } = parsed.data;

  try {
    const existing = await db
      .select()
      .from(waitlistTable)
      .where(eq(waitlistTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        message: "This email is already on the waitlist.",
        alreadyExists: true,
      });
      return;
    }

    await db.insert(waitlistTable).values({ email });

    res.status(201).json({
      success: true,
      message: "You're on the list! We'll notify you when Sentinel launches.",
      alreadyExists: false,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add to waitlist");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await db.select({ count: count() }).from(waitlistTable);
    res.json({ count: result[0]?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to get waitlist count");
    res.status(500).json({ error: "Internal server error", details: "Failed to process request" });
  }
});

export default router;
