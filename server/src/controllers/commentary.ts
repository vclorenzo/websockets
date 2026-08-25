import type { Request, Response } from "express";
import { createCommentary, listCommentary } from "../services/commentary.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";

export async function listCommentaryController(req: Request, res: Response) {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid match ID.", details: paramsResult.error.issues });
  }

  const queryResult = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({
      error: "Invalid query parameters.",
      details: queryResult.error.issues,
    });
  }

  try {
    const data = await listCommentary(
      paramsResult.data.id,
      queryResult.data.limit,
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error("Failed to fetch commentary:", error);
    res.status(500).json({ error: "Failed to fetch commentary." });
  }
}

export async function createCommentaryController(req: Request, res: Response) {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid match ID.", details: paramsResult.error.issues });
  }

  const bodyResult = createCommentarySchema.safeParse(req.body);

  if (!bodyResult.success) {
    return res.status(400).json({
      error: "Invalid commentary payload.",
      details: bodyResult.error.issues,
    });
  }

  try {
    const result = await createCommentary(
      paramsResult.data.id,
      bodyResult.data,
    );

    try {
      await Promise.resolve(
        res.app.locals.broadcastCommentary?.(result.matchId, result),
      );
    } catch {
      // Broadcast failure must not fail the request after persistence.
    }

    res.status(201).json({ data: result });
  } catch (error) {
    console.error("Failed to create commentary:", error);
    res.status(500).json({ error: "Failed to create commentary." });
  }
}
