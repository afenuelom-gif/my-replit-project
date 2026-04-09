import { Router, type IRouter } from "express";
import healthRouter from "./health";
import interviewRouter from "./interview/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(interviewRouter);

export default router;
