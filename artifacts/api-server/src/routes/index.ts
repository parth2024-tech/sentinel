import { Router, type IRouter } from "express";
import healthRouter from "./health";
import waitlistRouter from "./waitlist";
import reportsRouter from "./reports";
import myReportsRouter from "./myReports";
import devicesRouter from "./devices";
import pairRouter from "./pair";
import versionRouter from "./version";
import downloadsRouter from "./downloads";
import organizationsRouter from "./organizations";
import stripeWebhookRouter from "./webhooks/stripe";
import fleetRouter from "./fleet";
import liveRouter from "./live";

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
