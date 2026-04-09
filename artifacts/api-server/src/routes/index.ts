import { Router, type IRouter } from "express";
import healthRouter from "./health";
import interviewRouter from "./interview/index.js";
import usersRouter from "./users/index.js";
import devRouter from "./dev/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(interviewRouter);
router.use(usersRouter);
router.use(devRouter);

export default router;
