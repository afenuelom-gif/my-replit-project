import { Router, type IRouter } from "express";
import healthRouter from "./health";
import interviewRouter from "./interview/index.js";
import usersRouter from "./users/index.js";
import devRouter from "./dev/index.js";
import resumeRouter from "./resume/index.js";
import stripeRouter from "./stripe/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(interviewRouter);
router.use(usersRouter);
router.use(devRouter);
router.use(resumeRouter);
router.use(stripeRouter);

export default router;
