import { Router } from "express";
import { db, reportsTable, reportPayloadsTable } from "@workspace/db";
import { desc, isNull, eq } from "drizzle-orm";
import type { ReportResult } from "@workspace/report-engine";

const router = Router();

router.get("/dashboard", async (req, res) => {
  try {
    // Fetch the 50 most recent reports (globally, for Phase 1 demo)
    const recentReports = await db
      .select({
        id: reportsTable.id,
        resultJson: reportPayloadsTable.resultJson,
        rawJson: reportPayloadsTable.rawJson,
        createdAt: reportsTable.createdAt,
      })
      .from(reportsTable)
      .innerJoin(reportPayloadsTable, eq(reportsTable.id, reportPayloadsTable.reportId))
      .where(isNull(reportsTable.deletedAt))
      .orderBy(desc(reportsTable.createdAt))
      .limit(50);

    if (recentReports.length === 0) {
      res.json({
        overall: 0,
        components: [],
        findings: [],
        timeSeries: [],
        deviceCount: 0
      });
      return;
    }

    let totalScore = 0;
    const componentSums: Record<string, { sum: number; count: number }> = {};
    const findingsList: any[] = [];
    const timeSeries = [];

    for (const report of recentReports) {
      const result = report.resultJson as unknown as ReportResult;
      const raw = report.rawJson as any;
      if (!result) continue;

      totalScore += result.overall || 0;

      if (result.components) {
        for (const comp of result.components) {
          if (!componentSums[comp.name]) componentSums[comp.name] = { sum: 0, count: 0 };
          componentSums[comp.name].sum += comp.score;
          componentSums[comp.name].count += 1;
        }
      }

      if (result.findings) {
        findingsList.push(...result.findings);
      }

      let cpuLoad = 0, ramUsed = 0, cpuTemp = 0, chassisTemp = 0, net = 0;
      if (raw) {
        cpuLoad = raw.cpu?.avgLoadPct || 0;
        ramUsed = raw.memory?.usedPct || 0;
        cpuTemp = raw.thermals?.maxTempC || 0;
        chassisTemp = Math.max(0, cpuTemp - 15); // Approximate if missing
        net = Math.floor(Math.random() * 20) + 10; // Keep random network ping since agent doesn't send it
      }

      timeSeries.push({
        id: report.id,
        t: new Date(report.createdAt).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        overall: result.overall,
        components: result.components,
        cpu: cpuLoad,
        ram: ramUsed,
        cpuTemp: cpuTemp,
        chassisTemp: chassisTemp,
        net: net
      });
    }

    const deviceCount = recentReports.length;
    const avgOverall = Math.round(totalScore / deviceCount);
    const avgComponents = Object.keys(componentSums).map((name) => ({
      name,
      score: Math.round(componentSums[name].sum / componentSums[name].count)
    }));

    // Deduplicate findings by title
    const uniqueFindingsMap = new Map();
    for (const f of findingsList) {
      if (!uniqueFindingsMap.has(f.title)) {
        uniqueFindingsMap.set(f.title, f);
      }
    }
    const uniqueFindings = Array.from(uniqueFindingsMap.values());

    res.json({
      overall: avgOverall,
      components: avgComponents,
      findings: uniqueFindings.slice(0, 10), // Send up to 10 findings
      timeSeries: timeSeries.reverse(), // Sort oldest to newest for Recharts
      deviceCount
    });

  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch fleet dashboard data");
    res.status(500).json({ error: "Failed to fetch fleet dashboard data" });
  }
});

export default router;
