import { db } from './index.ts';
import { users, wallets } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, username?: string) {
  try {
    const defaultUsername = username || email.split('@')[0] || `player_${uid.slice(0, 6)}`;
    
    // Upsert user with PLAY369 production defaults
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        username: defaultUsername,
        operatorId: 'GAMEPLAY365_BD',
        currency: 'BDT',
        status: 'ACTIVE',
        countryCode: 'BD',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    const user = result[0];

    // Ensure user has a default BDT wallet with exact zero balance
    const existingWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, user.id));

    if (existingWallets.length === 0) {
      await db.insert(wallets).values({
        userId: user.id,
        currency: user.currency || 'BDT',
        realBalance: '0.0000',
        bonusBalance: '0.0000',
        lockedBalance: '0.0000',
        commissionBalance: '0.0000',
        balanceMinor: 0n,
        version: 1n,
        status: 'ACTIVE',
      });
    }

    return user;
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw new Error('Database user sync failed.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed for getUsers:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getWalletsByUserId(userId: number) {
  try {
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  } catch (error) {
    console.error('Database query failed for getWalletsByUserId:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
