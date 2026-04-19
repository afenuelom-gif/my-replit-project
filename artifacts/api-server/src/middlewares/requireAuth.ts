import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, loginEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import geoip from "geoip-lite";

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
    await ensureUserExists(DEV_USER_ID, { email: "dev@example.com", firstName: "Dev", lastName: "User" });
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

  // Fetch full user profile from Clerk and sync to our DB.
  let profile: { email?: string; firstName?: string; lastName?: string } = {};
  try {
    const clerk = clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    profile = {
      email: clerkUser.emailAddresses?.[0]?.emailAddress,
      firstName: clerkUser.firstName ?? undefined,
      lastName: clerkUser.lastName ?? undefined,
    };
  } catch {
    // Fall back to session claims if Clerk API is unreachable.
    profile.email = auth?.sessionClaims?.email as string | undefined;
  }

  await ensureUserExists(userId, profile);

  // Fire-and-forget: log this login event without blocking the request.
  logLoginEvent(userId, req).catch(() => {});

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

async function ensureUserExists(
  userId: string,
  profile: { email?: string; firstName?: string; lastName?: string },
): Promise<void> {
  await db
    .insert(usersTable)
    .values({
      id: userId,
      email: profile.email ?? null,
      firstName: profile.firstName ?? null,
      lastName: profile.lastName ?? null,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email: profile.email ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        updatedAt: new Date(),
      },
    });
}

async function logLoginEvent(userId: string, req: Request): Promise<void> {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim()
    ?? req.socket?.remoteAddress
    ?? null;

  let country: string | null = null;
  let city: string | null = null;
  if (ip) {
    try {
      const geo = geoip.lookup(ip);
      country = geo?.country ?? null;
      city = geo?.city ?? null;
    } catch {
      // geo lookup failed — non-fatal
    }
  }

  const userAgent = req.headers["user-agent"] ?? null;

  await db.insert(loginEventsTable).values({
    userId,
    ipAddress: ip,
    country,
    city,
    userAgent,
  });
}
