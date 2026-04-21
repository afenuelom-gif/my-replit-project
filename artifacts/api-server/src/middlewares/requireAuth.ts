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
const IS_REPLIT_DEV = (Boolean(process.env.REPL_ID) || process.env.NODE_ENV === "development") && process.env.NODE_ENV !== "production";
const USE_AUTH0 = !IS_REPLIT_DEV && Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID);

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
type CachedProfile = { profile: { email?: string; firstName?: string; lastName?: string }; expiresAt: number };
const profileCache = new Map<string, CachedProfile>();

interface Auth0UserInfo {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
}

const auth0TokenCache = new Map<string, { userInfo: Auth0UserInfo; expiresAt: number }>();

async function getAuth0UserInfo(token: string): Promise<Auth0UserInfo | null> {
  const cached = auth0TokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.userInfo;

  try {
    const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const userInfo = (await res.json()) as Auth0UserInfo;
    auth0TokenCache.set(token, { userInfo, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
    return userInfo;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (BYPASS_AUTH) {
    req.userId = DEV_USER_ID;
    await ensureUserExists(DEV_USER_ID, { email: "dev@example.com", firstName: "Dev", lastName: "User" });
    next();
    return;
  }

  if (USE_AUTH0) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.slice(7);
    const userInfo = await getAuth0UserInfo(token);
    if (!userInfo?.sub) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.userId = userInfo.sub;
    const profile = {
      email: userInfo.email,
      firstName: userInfo.given_name ?? userInfo.name?.split(" ")[0],
      lastName: userInfo.family_name ?? (userInfo.name?.split(" ").slice(1).join(" ") || undefined),
    };
    await ensureUserExists(userInfo.sub, profile);
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
  const clerkSessionId = auth?.sessionId ?? null;

  let profile: { email?: string; firstName?: string; lastName?: string } = {};
  const cached = clerkSessionId ? profileCache.get(clerkSessionId) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    profile = cached.profile;
  } else {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const primaryEmail = clerkUser.emailAddresses?.find(
        e => e.id === clerkUser.primaryEmailAddressId,
      ) ?? clerkUser.emailAddresses?.[0];
      profile = {
        email: primaryEmail?.emailAddress,
        firstName: clerkUser.firstName ?? undefined,
        lastName: clerkUser.lastName ?? undefined,
      };
      if (clerkSessionId) {
        profileCache.set(clerkSessionId, { profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
      }
    } catch {
      const fallbackEmail = auth?.sessionClaims?.email as string | undefined;
      if (fallbackEmail) profile.email = fallbackEmail;
    }
  }

  await ensureUserExists(userId, profile);
  logLoginEvent(userId, clerkSessionId, req).catch(() => {});
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (BYPASS_AUTH) {
    req.userId = DEV_USER_ID;
    next();
    return;
  }

  if (USE_AUTH0) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const userInfo = await getAuth0UserInfo(token).catch(() => null);
      if (userInfo?.sub) req.userId = userInfo.sub;
    }
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
      // non-fatal
    }
  }

  const rawUa = req.headers["user-agent"];
  const userAgent = (Array.isArray(rawUa) ? rawUa[0] : rawUa) ?? null;

  await db
    .insert(loginEventsTable)
    .values({ userId, clerkSessionId, ipAddress: ip, country, city, userAgent })
    .onConflictDoNothing();
}
