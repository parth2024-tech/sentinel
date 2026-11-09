import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import waitlistRouter from "./waitlist.js";
import reportsRouter from "./reports.js";
import myReportsRouter from "./myReports.js";
import devicesRouter from "./devices.js";
import pairRouter from "./pair.js";
import versionRouter from "./version.js";
import downloadsRouter from "./downloads.js";
import organizationsRouter from "./organizations.js";
import stripeWebhookRouter from "./webhooks/stripe.js";
import fleetRouter from "./fleet.js";
import liveRouter from "./live.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/waitlist", waitlistRouter);
router.use("/reports", reportsRouter);
router.use("/my-reports", myReportsRouter);
router.use("/devices", devicesRouter);
router.use("/pair", pairRouter);
router.use("/version", versionRouter);
router.use("/downloads", downloadsRouter);
router.use("/organizations", organizationsRouter);
router.use("/webhooks/stripe", stripeWebhookRouter);
router.use("/fleet", fleetRouter);
router.use("/live", liveRouter);

export default router;
