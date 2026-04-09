import { Router, type IRouter } from "express";

const router: IRouter = Router();

const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";

router.get("/dev/status", (req, res): void => {
  res.json({
    bypassAuth: BYPASS_AUTH,
    nodeEnv: process.env.NODE_ENV ?? "development",
  });
});

export default router;
