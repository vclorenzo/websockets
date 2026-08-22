import { desc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus, syncMatchStatus } from "../utils/match-status.js";
import { MATCH_STATUS } from "../validation/matches.js";

const MAX_LIMIT = 100;

export class MatchServiceError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_TIMES" | "NOT_FOUND" | "NOT_LIVE",
  ) {
    super(message);
    this.name = "MatchServiceError";
  }
}

export type CreateMatchInput = {
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  endTime: string;
  homeScore?: number;
  awayScore?: number;
};

export type UpdateScoreInput = {
  homeScore: number;
  awayScore: number;
};

export async function listMatches(limit = 50) {
  const cappedLimit = Math.min(limit, MAX_LIMIT);

  return db
    .select()
    .from(matches)
    .orderBy(desc(matches.createdAt))
    .limit(cappedLimit);
}

export async function createMatch(input: CreateMatchInput) {
  const { startTime, endTime, homeScore, awayScore, ...rest } = input;

  const start = new Date(startTime);
  const end = new Date(endTime);
  const status = getMatchStatus(start, end);

  if (!status) {
    throw new MatchServiceError(
      "Invalid startTime or endTime.",
      "INVALID_TIMES",
    );
  }

  const [event] = await db
    .insert(matches)
    .values({
      ...rest,
      startTime: start,
      endTime: end,
      homeScore: homeScore ?? 0,
      awayScore: awayScore ?? 0,
      status,
    })
    .returning();

  return event;
}

export async function updateMatchScore(
  matchId: number,
  input: UpdateScoreInput,
) {
  const [existing] = await db
    .select({
      id: matches.id,
      status: matches.status,
      startTime: matches.startTime,
      endTime: matches.endTime,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!existing) {
    throw new MatchServiceError("Match not found", "NOT_FOUND");
  }

  await syncMatchStatus(existing, async (nextStatus) => {
    await db
      .update(matches)
      .set({ status: nextStatus })
      .where(eq(matches.id, matchId));
  });

  if (existing.status !== MATCH_STATUS.LIVE) {
    throw new MatchServiceError("Match is not live", "NOT_LIVE");
  }

  const [updated] = await db
    .update(matches)
    .set({
      homeScore: input.homeScore,
      awayScore: input.awayScore,
    })
    .where(eq(matches.id, matchId))
    .returning();

  return updated;
}
