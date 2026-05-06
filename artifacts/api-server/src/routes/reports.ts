import { Router } from "express";
import { ReportsController } from "../controllers/reports.controller";

const router = Router();

router.post("/", ReportsController.createReport);
router.post("/:id/claim", ReportsController.claimReport);
router.post("/:id/habit-answers", ReportsController.submitHabitAnswers);
router.get("/:id", ReportsController.getReport);
router.post("/:id/share", ReportsController.generateShareToken);
router.get("/shared/:shareToken", ReportsController.getSharedReport);

export default router;
