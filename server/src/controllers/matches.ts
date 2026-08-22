import type { Request, Response } from "express";
import {
  createMatch,
  listMatches,
  MatchServiceError,
  updateMatchScore,
} from "../services/matches.js";
import {
  createMatchSchema,
  listMatchesQuerySchema,
  matchIdParamSchema,
  updateScoreSchema,
} from "../validation/matches.js";

export async function listMatchesController(req: Request, res: Response) {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid query.", details: parsed.error.issues });
  }

  try {
    const data = await listMatches(parsed.data.limit);
    res.json({ data });
  } catch {
    res.status(500).json({ error: "Failed to list matches." });
  }
}

export async function createMatchController(req: Request, res: Response) {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload.", details: parsed.error.issues });
  }

  try {
    const event = await createMatch(parsed.data);

    try {
      await Promise.resolve(res.app.locals.broadcastMatchCreated?.(event));
    } catch {
      // Broadcast failure must not fail the request after persistence.
    }

    res.status(201).json({ data: event });
  } catch (e) {
    if (e instanceof MatchServiceError && e.code === "INVALID_TIMES") {
      return res.status(400).json({ error: e.message });
    }

    res
      .status(500)
      .json({ error: "Failed to create match.", details: JSON.stringify(e) });
  }
}

export async function updateScoreController(req: Request, res: Response) {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({
      error: "Invalid match id",
      details: paramsParsed.error.issues,
    });
  }

  const bodyParsed = updateScoreSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: bodyParsed.error.issues,
    });
  }

  const matchId = paramsParsed.data.id;

  try {
    const updated = await updateMatchScore(matchId, bodyParsed.data);

    try {
      await Promise.resolve(
        res.app.locals.broadcastScoreUpdate?.(matchId, {
          homeScore: updated.homeScore,
          awayScore: updated.awayScore,
        }),
      );
    } catch {
      // Broadcast failure must not fail the request after persistence.
    }

    res.json({ data: updated });
  } catch (err) {
    if (err instanceof MatchServiceError) {
      if (err.code === "NOT_FOUND") {
        return res.status(404).json({ error: err.message });
      }
      if (err.code === "NOT_LIVE") {
        return res.status(409).json({ error: err.message });
      }
    }

    res.status(500).json({ error: "Failed to update score" });
  }
}
