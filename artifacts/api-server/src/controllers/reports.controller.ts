import { Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { ReportsService } from "../services/reports.service.js";
import { timingSafeEqualStr } from "../lib/crypto.js";

const BoundedHabitAnswers = z
  .record(z.string().max(64), z.number().finite().min(0).max(100))
  .refine((obj) => Object.keys(obj).length <= 32, "Maximum 32 habit keys allowed");

const PostReportBody = z.object({
  rawJson: z.record(z.string().max(128), z.unknown()),
  habitAnswers: BoundedHabitAnswers.optional(),
  legacy: z.boolean().optional().default(false),
});

const ClaimBody = z.object({
  claimToken: z.string().min(8).max(64),
  email: z.string().email().max(254).optional(),
});

const HabitAnswersBody = z.object({
  claimToken: z.string().min(8).max(64),
  habitAnswers: BoundedHabitAnswers,
});

const ShareBody = z.object({
  claimToken: z.string().min(8).max(64),
});

export class ReportsController {
  static async createReport(req: Request, res: Response) {
    const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
    if (contentLength > 256 * 1024) {
      res.status(413).json({ error: "Payload too large. Maximum 256 KB." });
      return;
    }

    const authHeader = req.headers["authorization"];
    const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    const deviceToken = typeof authHeaderStr === "string" && authHeaderStr.startsWith("Bearer ") ? authHeaderStr.slice(7).trim() : undefined;
    const idKeyHeader = req.headers["idempotency-key"];
    const idempotencyKey = typeof idKeyHeader === "string" ? idKeyHeader : (Array.isArray(idKeyHeader) ? idKeyHeader[0] : undefined);

    const timestampHeader = req.headers["x-sentinel-timestamp"];
    const signatureHeader = req.headers["x-sentinel-signature"];
    const timestampStr = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    const signatureStr = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (signatureStr) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (!timestampStr) {
        res.setHeader("X-Sentinel-Server-Time", nowSec.toString());
        res.status(401).json({ error: "Missing attestation timestamp header.", serverTime: nowSec });
        return;
      }
      const ts = parseInt(timestampStr, 10);
      if (isNaN(ts) || Math.abs(nowSec - ts) > 300) {
        res.setHeader("X-Sentinel-Server-Time", nowSec.toString());
        res.status(401).json({
          error: "Attestation timestamp expired or outside acceptable clock skew.",
          serverTime: nowSec,
        });
        return;
      }

      // Capture exact wire bytes to prevent serialization drift
      const rawBodyBuf = (req as Request & { rawBody?: Buffer }).rawBody;
      const wireBytes = rawBodyBuf ? rawBodyBuf.toString("utf8") : JSON.stringify(req.body);
      const signaturePayload = `${timestampStr}.${wireBytes}`;

      let expectedSig: string;
      if (deviceToken && deviceToken.length >= 10) {
        // Paired agent: Keyed HMAC-SHA256 bound to domain-separated signing key derived from deviceToken
        const derivedKey = crypto.createHash("sha256").update(`sentinel-sig-v1:${deviceToken}`).digest();
        expectedSig = crypto.createHmac("sha256", derivedKey).update(signaturePayload).digest("hex");
      } else {
        // Anonymous OneShot client: Digest attestation over timestamp + payload wire bytes.
        // SECURITY INVARIANT: Unauthenticated OneShot clients cannot bypass authentication,
        // rate-limits, or plausibility checks with this signature. It functions strictly as a
        // wire-integrity/anti-tamper checksum to detect in-transit payload corruption.
        expectedSig = crypto.createHash("sha256").update(signaturePayload).digest("hex");
      }

      if (!timingSafeEqualStr(signatureStr, expectedSig)) {
        res.setHeader("X-Sentinel-Server-Time", nowSec.toString());
        res.status(401).json({ error: "Invalid attestation signature.", serverTime: nowSec });
        return;
      }
    }

    const parsed = PostReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.message });
      return;
    }

    // Explicitly use the IP resolving logic
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

    try {
      const result = await ReportsService.createReport(
        { rawJson: parsed.data.rawJson, habitAnswers: parsed.data.habitAnswers, legacy: parsed.data.legacy },
        ip,
        idempotencyKey,
        deviceToken,
        req.log
      );
      res.status(result.deduplicated ? 200 : 201).json(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message === "Invalid device token") {
        res.status(401).json({ error: error.message });
      } else if (error.message.startsWith("UPGRADE_REQUIRED")) {
        res.status(426).json({
          error: "Upgrade Required",
          message: error.message.replace("UPGRADE_REQUIRED: ", ""),
          minimumVersion: 1,
        });
      } else if (error.message.startsWith("Invalid report data") || error.message === "Rate limit exceeded") {
        res.status(422).json({ error: error.message });
      } else {
        req.log.error({ err: error }, "Failed to create report");
        res.status(500).json({ error: "Failed to process report" });
      }
    }
  }

  static async claimReport(req: Request, res: Response) {
    const id = req.params.id;
    if (typeof id !== "string" || id.length < 4) {
      res.status(400).json({ error: "Invalid report ID" });
      return;
    }

    const parsed = ClaimBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid claim request", details: parsed.error.message });
      return;
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

    try {
      const result = await ReportsService.claimReport(id, parsed.data.claimToken, parsed.data.email, ip, req.log);
      res.json(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message === "Report not found") res.status(404).json({ error: error.message });
      else if (error.message === "Invalid claim token") res.status(403).json({ error: error.message });
      else if (error.message === "Rate limit exceeded") res.status(429).json({ error: error.message });
      else res.status(500).json({ error: "Failed to claim report" });
    }
  }

  static async submitHabitAnswers(req: Request, res: Response) {
    const id = req.params.id;
    if (typeof id !== "string" || id.length < 4) {
      res.status(400).json({ error: "Invalid report ID" });
      return;
    }

    const parsed = HabitAnswersBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.message });
      return;
    }

    try {
      const result = await ReportsService.submitHabitAnswers(id, parsed.data.claimToken, parsed.data.habitAnswers, req.log);
      res.json(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message === "Report not found") res.status(404).json({ error: error.message });
      else if (error.message === "Invalid claim token") res.status(403).json({ error: error.message });
      else res.status(500).json({ error: "Failed to submit habit answers" });
    }
  }

  static async getReport(req: Request, res: Response) {
    const id = req.params.id;
    if (typeof id !== "string" || id.length < 4) {
      res.status(400).json({ error: "Invalid report ID" });
      return;
    }

    try {
      const result = await ReportsService.getReport(id);
      res.json(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message === "Report not found") res.status(404).json({ error: error.message });
      else res.status(500).json({ error: "Failed to get report" });
    }
  }

  static async generateShareToken(req: Request, res: Response) {
    const id = req.params.id;
    if (typeof id !== "string" || id.length < 4) {
      res.status(400).json({ error: "Invalid report ID" });
      return;
    }

    const parsed = ShareBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid request", details: parsed.error.message });
      return;
    }

    try {
      const shareToken = await ReportsService.generateShareToken(id, parsed.data.claimToken, req.log);
      res.json({ shareToken });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message === "Report not found") res.status(404).json({ error: error.message });
      else if (error.message === "Invalid claim token") res.status(403).json({ error: error.message });
      else res.status(500).json({ error: "Failed to share report" });
    }
  }

  static async getSharedReport(req: Request, res: Response) {
    const shareToken = req.params.shareToken;
    if (typeof shareToken !== "string" || shareToken.length < 10) {
      res.status(400).json({ error: "Invalid share token" });
      return;
    }

    try {
      const result = await ReportsService.getSharedReport(shareToken);
      res.json(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message === "Report not found") res.status(404).json({ error: error.message });
      else res.status(500).json({ error: "Failed to get shared report" });
    }
  }
}
