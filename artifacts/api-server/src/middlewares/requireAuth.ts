import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, loginEventsTable } from "@workspace/db";
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
    const clerkUser = await clerkClient.users.getUser(userId);
    // Prefer the user's designated primary email; fall back to the first address.
    const primaryEmail = clerkUser.emailAddresses?.find(
      e => e.id === clerkUser.primaryEmailAddressId,
    ) ?? clerkUser.emailAddresses?.[0];
    profile = {
      email: primaryEmail?.emailAddress,
      firstName: clerkUser.firstName ?? undefined,
      lastName: clerkUser.lastName ?? undefined,
    };
  } catch {
    // Fall back to session claims if Clerk API is unreachable.
    // Only email is available here; name fields stay undefined so we don't
    // overwrite existing data on a transient Clerk outage.
    const fallbackEmail = auth?.sessionClaims?.email as string | undefined;
    if (fallbackEmail) profile.email = fallbackEmail;
  }

  await ensureUserExists(userId, profile);

  // Fire-and-forget: log a login event keyed on the Clerk session ID so that
  // repeated API calls within the same session produce only one row.
  const clerkSessionId = auth?.sessionId ?? null;
  logLoginEvent(userId, clerkSessionId, req).catch(() => {});

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
  // Build the update set for existing users — only include fields that were
  // actually retrieved so a transient Clerk failure never wipes out stored data.
  const updateSet: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
  if (profile.email !== undefined) updateSet.email = profile.email;
  if (profile.firstName !== undefined) updateSet.firstName = profile.firstName;
  if (profile.lastName !== undefined) updateSet.lastName = profile.lastName;

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
      set: updateSet,
    });
}

async function logLoginEvent(
  userId: string,
  clerkSessionId: string | null,
  req: Request,
): Promise<void> {
  // Without a session ID we cannot deduplicate, so skip to avoid duplicate rows
  // (PostgreSQL unique constraints allow multiple NULLs).
  if (!clerkSessionId) return;

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
      // geo lookup is non-fatal
    }
  }

  const userAgent = req.headers["user-agent"] ?? null;

  await db
    .insert(loginEventsTable)
    .values({
      userId,
      clerkSessionId,
      ipAddress: ip,
      country,
      city,
      userAgent,
    })
    // One row per Clerk session — subsequent API calls in the same session are skipped.
    .onConflictDoNothing();
}
