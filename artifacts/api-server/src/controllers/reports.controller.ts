import { Request, Response } from "express";
import { z } from "zod";
import { ReportsService } from "../services/reports.service";

const PostReportBody = z.object({
  rawJson: z.record(z.unknown()),
  habitAnswers: z.record(z.number()).optional(),
  legacy: z.boolean().optional().default(false),
});

const ClaimBody = z.object({
  claimToken: z.string().min(8).max(64),
  email: z.string().email().max(254).optional(),
});

const HabitAnswersBody = z.object({
  claimToken: z.string().min(8).max(64),
  habitAnswers: z.record(z.number()),
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

    const parsed = PostReportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.message });
      return;
    }

    // Explicitly use the IP resolving logic
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

    try {
      const result = await ReportsService.createReport(parsed.data, ip, idempotencyKey, deviceToken, req.log);
      res.status(result.deduplicated ? 200 : 201).json(result);
    } catch (err: any) {
      if (err.message === "Invalid device token") {
        res.status(401).json({ error: err.message });
      } else if (err.message.startsWith("Invalid report data") || err.message === "Rate limit exceeded") {
        res.status(422).json({ error: err.message });
      } else {
        req.log.error({ err }, "Failed to create report");
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

    try {
      const result = await ReportsService.claimReport(id, parsed.data.claimToken, parsed.data.email, req.log);
      res.json(result);
    } catch (err: any) {
      if (err.message === "Report not found") res.status(404).json({ error: err.message });
      else if (err.message === "Invalid claim token") res.status(403).json({ error: err.message });
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
    } catch (err: any) {
      if (err.message === "Report not found") res.status(404).json({ error: err.message });
      else if (err.message === "Invalid claim token") res.status(403).json({ error: err.message });
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
    } catch (err: any) {
      if (err.message === "Report not found") res.status(404).json({ error: err.message });
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
    } catch (err: any) {
      if (err.message === "Report not found") res.status(404).json({ error: err.message });
      else if (err.message === "Invalid claim token") res.status(403).json({ error: err.message });
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
    } catch (err: any) {
      if (err.message === "Report not found") res.status(404).json({ error: err.message });
      else res.status(500).json({ error: "Failed to get shared report" });
    }
  }
}
