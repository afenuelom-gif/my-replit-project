import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export class StripeStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user ?? null;
  }

  async updateUserStripeInfo(
    userId: string,
    stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string; plan?: string },
  ) {
    const [user] = await db
      .update(usersTable)
      .set(stripeInfo)
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }
}

export const stripeStorage = new StripeStorage();
