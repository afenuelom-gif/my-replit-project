import { db, usersTable, processedTopupSessionsTable } from "@workspace/db";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { stripeService } from "./stripeService.js";
import { logger } from "./logger.js";

export async function grantTopupCredits(opts: {
  sessionId: string;
  userId: string;
  priceId: string;
}): Promise<{ granted: boolean; creditsAdded: number }> {
  const { sessionId, userId, priceId } = opts;

  const creditsToAdd = stripeService.getTopUpCreditsForPrice(priceId);
  if (creditsToAdd === 0) {
    logger.warn({ sessionId, userId, priceId }, "Top-up: unrecognised priceId — no credits granted");
    return { granted: false, creditsAdded: 0 };
  }

  try {
    await db.insert(processedTopupSessionsTable).values({
      sessionId,
      userId,
      creditsAdded: creditsToAdd,
    });
  } catch {
    logger.info({ sessionId, userId }, "Top-up: session already processed — skipping duplicate");
    return { granted: false, creditsAdded: 0 };
  }

  await db
    .update(usersTable)
    .set({ resumeTailoringCredits: drizzleSql`${usersTable.resumeTailoringCredits} + ${creditsToAdd}` })
    .where(eq(usersTable.id, userId));

  logger.info({ sessionId, userId, priceId, creditsToAdd }, "Top-up credits granted");
  return { granted: true, creditsAdded: creditsToAdd };
}
