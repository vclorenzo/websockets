import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/matches.js", () => ({
  listMatches: vi.fn(),
  createMatch: vi.fn(),
  updateMatchScore: vi.fn(),
  MatchServiceError: class MatchServiceError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "MatchServiceError";
      this.code = code;
    }
  },
}));

import {
  createMatch,
  listMatches,
  MatchServiceError,
  updateMatchScore,
} from "../services/matches.js";
import {
  createMatchController,
  listMatchesController,
  updateScoreController,
} from "./matches.js";

function createRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.app = { locals: {} };
  return res;
}

beforeEach(() => {
  vi.mocked(listMatches).mockReset();
  vi.mocked(createMatch).mockReset();
  vi.mocked(updateMatchScore).mockReset();
});

describe("listMatchesController", () => {
  it("returns 400 for an invalid query", async () => {
    const req: any = { query: { limit: "-1" } };
    const res = createRes();

    await listMatchesController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid query." }),
    );
    expect(listMatches).not.toHaveBeenCalled();
  });

  it("returns the list of matches on success", async () => {
    const rows = [{ id: 1 }];
    vi.mocked(listMatches).mockResolvedValue(rows as any);
    const req: any = { query: { limit: "10" } };
    const res = createRes();

    await listMatchesController(req, res);

    expect(listMatches).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith({ data: rows });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("passes an undefined limit through when the query omits it", async () => {
    vi.mocked(listMatches).mockResolvedValue([] as any);
    const req: any = { query: {} };
    const res = createRes();

    await listMatchesController(req, res);

    expect(listMatches).toHaveBeenCalledWith(undefined);
  });

  it("returns 500 when the service throws", async () => {
    vi.mocked(listMatches).mockRejectedValue(new Error("db down"));
    const req: any = { query: {} };
    const res = createRes();

    await listMatchesController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to list matches.",
    });
  });
});

describe("createMatchController", () => {
  const validBody = {
    sport: "soccer",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startTime: "2026-01-01T10:00:00.000Z",
    endTime: "2026-01-01T12:00:00.000Z",
  };

  it("returns 400 for an invalid payload", async () => {
    const req: any = { body: { ...validBody, sport: "" } };
    const res = createRes();

    await createMatchController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid payload." }),
    );
    expect(createMatch).not.toHaveBeenCalled();
  });

  it("creates a match and broadcasts when a broadcaster is registered", async () => {
    const event = { id: 1, ...validBody };
    vi.mocked(createMatch).mockResolvedValue(event as any);
    const broadcast = vi.fn();
    const req: any = { body: validBody };
    const res = createRes();
    res.app.locals.broadcastMatchCreated = broadcast;

    await createMatchController(req, res);

    expect(createMatch).toHaveBeenCalledWith(validBody);
    expect(broadcast).toHaveBeenCalledWith(event);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: event });
  });

  it("creates a match without broadcasting when no broadcaster is registered", async () => {
    const event = { id: 2, ...validBody };
    vi.mocked(createMatch).mockResolvedValue(event as any);
    const req: any = { body: validBody };
    const res = createRes();

    await createMatchController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: event });
  });

  it("returns 400 when the service throws an INVALID_TIMES error", async () => {
    vi.mocked(createMatch).mockRejectedValue(
      new MatchServiceError(
        "Invalid startTime or endTime.",
        "INVALID_TIMES",
      ),
    );
    const req: any = { body: validBody };
    const res = createRes();

    await createMatchController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid startTime or endTime.",
    });
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(createMatch).mockRejectedValue(new Error("boom"));
    const req: any = { body: validBody };
    const res = createRes();

    await createMatchController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Failed to create match." }),
    );
  });
});

describe("updateScoreController", () => {
  it("returns 400 for an invalid match id", async () => {
    const req: any = {
      params: { id: "abc" },
      body: { homeScore: 1, awayScore: 1 },
    };
    const res = createRes();

    await updateScoreController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid match id" }),
    );
    expect(updateMatchScore).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload", async () => {
    const req: any = {
      params: { id: "1" },
      body: { homeScore: -1, awayScore: 1 },
    };
    const res = createRes();

    await updateScoreController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid payload" }),
    );
    expect(updateMatchScore).not.toHaveBeenCalled();
  });

  it("updates the score and broadcasts when a broadcaster is registered", async () => {
    const updated = { id: 1, homeScore: 2, awayScore: 1 };
    vi.mocked(updateMatchScore).mockResolvedValue(updated as any);
    const broadcast = vi.fn();
    const req: any = {
      params: { id: "1" },
      body: { homeScore: 2, awayScore: 1 },
    };
    const res = createRes();
    res.app.locals.broadcastScoreUpdate = broadcast;

    await updateScoreController(req, res);

    expect(updateMatchScore).toHaveBeenCalledWith(1, {
      homeScore: 2,
      awayScore: 1,
    });
    expect(broadcast).toHaveBeenCalledWith(1, {
      homeScore: 2,
      awayScore: 1,
    });
    expect(res.json).toHaveBeenCalledWith({ data: updated });
  });

  it("updates the score without broadcasting when no broadcaster is registered", async () => {
    const updated = { id: 1, homeScore: 2, awayScore: 1 };
    vi.mocked(updateMatchScore).mockResolvedValue(updated as any);
    const req: any = {
      params: { id: "1" },
      body: { homeScore: 2, awayScore: 1 },
    };
    const res = createRes();

    await updateScoreController(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: updated });
  });

  it("returns 404 when the match is not found", async () => {
    vi.mocked(updateMatchScore).mockRejectedValue(
      new MatchServiceError("Match not found", "NOT_FOUND"),
    );
    const req: any = {
      params: { id: "1" },
      body: { homeScore: 2, awayScore: 1 },
    };
    const res = createRes();

    await updateScoreController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Match not found" });
  });

  it("returns 409 when the match is not live", async () => {
    vi.mocked(updateMatchScore).mockRejectedValue(
      new MatchServiceError("Match is not live", "NOT_LIVE"),
    );
    const req: any = {
      params: { id: "1" },
      body: { homeScore: 2, awayScore: 1 },
    };
    const res = createRes();

    await updateScoreController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Match is not live" });
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(updateMatchScore).mockRejectedValue(new Error("boom"));
    const req: any = {
      params: { id: "1" },
      body: { homeScore: 2, awayScore: 1 },
    };
    const res = createRes();

    await updateScoreController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to update score",
    });
  });
});