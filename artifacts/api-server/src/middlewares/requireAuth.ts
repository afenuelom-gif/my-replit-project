import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";
const DEV_USER_ID = "dev_bypass_user";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (BYPASS_AUTH) {
    req.userId = DEV_USER_ID;
    await ensureUserExists(DEV_USER_ID, "dev@example.com");
    next();
    return;
  }

  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  const emailAddress = auth?.sessionClaims?.email as string | undefined;
  await ensureUserExists(userId, emailAddress);
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  if (BYPASS_AUTH) {
    req.userId = DEV_USER_ID;
    next();
    return;
  }

  const auth = getAuth(req);
  if (auth?.userId) {
    req.userId = auth.userId;
  }
  next();
}

async function ensureUserExists(userId: string, email?: string): Promise<void> {
  const existing = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(usersTable).values({
      id: userId,
      email: email ?? null,
    }).onConflictDoNothing();
  }
}
