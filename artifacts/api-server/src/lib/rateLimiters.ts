import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

function userOrIpKey(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) return `user:${userId}`;
  return ipKeyGenerator(req);
}

function tooManyRequestsHandler(_req: Request, res: Response): void {
  const retryAfter = res.getHeader("Retry-After");
  res.status(429).json({
    code: "RATE_LIMITED",
    error: "Too many requests — please wait a moment before trying again.",
    ...(retryAfter ? { retryAfterSeconds: Number(retryAfter) } : {}),
  });
}

const base = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: tooManyRequestsHandler,
};

export const resumeTailorLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: undefined,
});

export const sessionCreateLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 15,
  message: undefined,
});

export const nextQuestionLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 40,
  message: undefined,
});

export const transcribeLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: undefined,
});

export const ttsLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 120,
  message: undefined,
});

export const postureLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: undefined,
});
