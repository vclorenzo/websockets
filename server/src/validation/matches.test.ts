import { describe, expect, it } from "vitest";
import {
  createMatchSchema,
  listMatchesQuerySchema,
  matchIdParamSchema,
  MATCH_STATUS,
  updateScoreSchema,
} from "./matches.js";

describe("MATCH_STATUS", () => {
  it("exposes the expected status values", () => {
    expect(MATCH_STATUS).toEqual({
      SCHEDULED: "scheduled",
      LIVE: "live",
      FINISHED: "finished",
    });
  });
});

describe("listMatchesQuerySchema", () => {
  it("allows an omitted limit", () => {
    const result = listMatchesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBeUndefined();
    }
  });

  it("coerces a numeric string limit to a number", () => {
    const result = listMatchesQuerySchema.safeParse({ limit: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it("rejects a limit of zero", () => {
    const result = listMatchesQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative limit", () => {
    const result = listMatchesQuerySchema.safeParse({ limit: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects a limit greater than 100", () => {
    const result = listMatchesQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("accepts a limit of exactly 100", () => {
    const result = listMatchesQuerySchema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-numeric limit", () => {
    const result = listMatchesQuerySchema.safeParse({ limit: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer limit", () => {
    const result = listMatchesQuerySchema.safeParse({ limit: "10.5" });
    expect(result.success).toBe(false);
  });
});

describe("matchIdParamSchema", () => {
  it("coerces a numeric string id to a number", () => {
    const result = matchIdParamSchema.safeParse({ id: "42" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
    }
  });

  it("rejects a zero id", () => {
    const result = matchIdParamSchema.safeParse({ id: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative id", () => {
    const result = matchIdParamSchema.safeParse({ id: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer id", () => {
    const result = matchIdParamSchema.safeParse({ id: "1.5" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric id", () => {
    const result = matchIdParamSchema.safeParse({ id: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing id", () => {
    const result = matchIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createMatchSchema", () => {
  const validPayload = {
    sport: "soccer",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startTime: "2026-01-01T10:00:00.000Z",
    endTime: "2026-01-01T12:00:00.000Z",
  };

  it("accepts a valid payload without optional scores", () => {
    const result = createMatchSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.homeScore).toBeUndefined();
      expect(result.data.awayScore).toBeUndefined();
    }
  });

  it("accepts a valid payload with scores", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: 2,
      awayScore: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.homeScore).toBe(2);
      expect(result.data.awayScore).toBe(1);
    }
  });

  it("coerces numeric string scores", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: "3",
      awayScore: "0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.homeScore).toBe(3);
      expect(result.data.awayScore).toBe(0);
    }
  });

  it("rejects an empty sport", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      sport: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty homeTeam", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeTeam: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty awayTeam", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      awayTeam: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid startTime string", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: "not-a-date",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("startTime"),
      );
      expect(issue).toBeDefined();
    }
  });

  it("rejects an invalid endTime string", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      endTime: "not-a-date",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("endTime"),
      );
      expect(issue).toBeDefined();
    }
  });

  it("rejects when endTime is before startTime", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: "2026-01-01T12:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("endTime"),
      );
      expect(issue?.message).toBe("endTime must be after startTime");
    }
  });

  it("rejects when endTime equals startTime", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: "2026-01-01T10:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative homeScore", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative awayScore", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      awayScore: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer homeScore", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("does not short-circuit endTime-after-startTime check when dates are unparsable", () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: "not-a-date",
      endTime: "also-not-a-date",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const orderIssue = result.error.issues.find(
        (i) => i.message === "endTime must be after startTime",
      );
      expect(orderIssue).toBeUndefined();
    }
  });
});

describe("updateScoreSchema", () => {
  it("accepts valid scores", () => {
    const result = updateScoreSchema.safeParse({
      homeScore: 1,
      awayScore: 2,
    });
    expect(result.success).toBe(true);
  });

  it("coerces numeric string scores", () => {
    const result = updateScoreSchema.safeParse({
      homeScore: "1",
      awayScore: "2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.homeScore).toBe(1);
      expect(result.data.awayScore).toBe(2);
    }
  });

  it("accepts a score of zero", () => {
    const result = updateScoreSchema.safeParse({
      homeScore: 0,
      awayScore: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative homeScore", () => {
    const result = updateScoreSchema.safeParse({
      homeScore: -1,
      awayScore: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative awayScore", () => {
    const result = updateScoreSchema.safeParse({
      homeScore: 0,
      awayScore: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer score", () => {
    const result = updateScoreSchema.safeParse({
      homeScore: 1.2,
      awayScore: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing homeScore", () => {
    const result = updateScoreSchema.safeParse({ awayScore: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing awayScore", () => {
    const result = updateScoreSchema.safeParse({ homeScore: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric score values", () => {
    const result = updateScoreSchema.safeParse({
      homeScore: "abc",
      awayScore: 0,
    });
    expect(result.success).toBe(false);
  });
});