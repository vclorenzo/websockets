import { desc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";

const MAX_LIMIT = 100;

export type CreateCommentaryInput = {
  minute: number;
  sequence?: number;
  period?: string;
  eventType?: string;
  actor?: string;
  team?: string;
  message: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
};

export async function listCommentary(matchId: number, limit = 10) {
  const safeLimit = Math.min(limit, MAX_LIMIT);

  return db
    .select()
    .from(commentary)
    .where(eq(commentary.matchId, matchId))
    .orderBy(desc(commentary.createdAt))
    .limit(safeLimit);
}

export async function createCommentary(
  matchId: number,
  input: CreateCommentaryInput,
) {
  const { minute, ...rest } = input;

  const [result] = await db
    .insert(commentary)
    .values({
      matchId,
      minute,
      ...rest,
    })
    .returning();

  return result;
}
