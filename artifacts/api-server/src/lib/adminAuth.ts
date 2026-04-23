import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export function getAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const adminIds = getAdminIds();
  return adminIds.length > 0 && adminIds.includes(userId);
}

export async function isAdminUserOrEmail(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  const adminIds = getAdminIds();
  const adminEmails = getAdminEmails();

  logger.info({ adminIds, adminEmails, userId }, "[adminAuth] checking admin access");

  if (adminIds.length === 0 && adminEmails.length === 0) {
    logger.warn("[adminAuth] no ADMIN_USER_IDS or ADMIN_EMAILS configured — denying admin");
    return false;
  }

  if (adminIds.includes(userId)) return true;

  if (adminEmails.length > 0) {
    try {
      const [user] = await db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      logger.info({ dbEmail: user?.email, adminEmails }, "[adminAuth] email check");
      if (user?.email && adminEmails.includes(user.email.toLowerCase())) return true;
    } catch (err) {
      logger.error({ err }, "[adminAuth] DB lookup failed");
    }
  }

  return false;
}

export function hasAnyAdminConfigured(): boolean {
  return getAdminIds().length > 0 || getAdminEmails().length > 0;
}
