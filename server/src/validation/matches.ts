import { z } from "zod";

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
} as const;

const isValidIsoDateString = (value: string) =>
  !Number.isNaN(Date.parse(value));

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createMatchSchema = z
  .object({
    sport: z.string().min(1),
    homeTeam: z.string().min(1),
    awayTeam: z.string().min(1),
    startTime: z.string(),
    endTime: z.string(),
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .refine((data) => isValidIsoDateString(data.startTime), {
    message: "startTime must be a valid ISO date string",
    path: ["startTime"],
  })
  .refine((data) => isValidIsoDateString(data.endTime), {
    message: "endTime must be a valid ISO date string",
    path: ["endTime"],
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startTime);
    const end = Date.parse(data.endTime);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        message: "endTime must be after startTime",
        path: ["endTime"],
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
