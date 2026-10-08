import { eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "./schema";

/** メールアドレス（大文字・小文字は区別しない）で登録済みのユーザーを探し、users.id を返す。いなければ null */
export async function findUserIdByEmail(db: DrizzleD1Database, email: string): Promise<number | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()));
  return user?.id ?? null;
}
