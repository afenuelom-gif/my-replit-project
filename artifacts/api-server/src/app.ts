import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedInterviewersIfNeeded, patchFemaleInterviewerVoices } from "./lib/seedInterviewers";

const USE_AUTH0 = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

if (!USE_AUTH0) {
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

if (!USE_AUTH0) {
  app.use(clerkMiddleware());
}

app.use("/api", router);

seedInterviewersIfNeeded().catch(err => logger.error({ err }, "Seeding interviewers failed"));
patchFemaleInterviewerVoices().catch(err => logger.error({ err }, "Patching female interviewer voices failed"));

export default app;
