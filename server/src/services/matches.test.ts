import { beforeEach, describe, expect, it, vi } from "vitest";
import { MATCH_STATUS } from "../validation/matches.js";

const { dbMock, buildQueryMock } = vi.hoisted(() => {
  function buildQueryMock(result: unknown) {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.from = vi.fn(() => builder);
    builder.where = vi.fn(() => builder);
    builder.orderBy = vi.fn(() => builder);
    builder.set = vi.fn(() => builder);
    builder.values = vi.fn(() => builder);
    builder.limit = vi.fn(() => Promise.resolve(result));
    builder.returning = vi.fn(() => Promise.resolve(result));
    return builder;
  }

  const dbMock = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  return { dbMock, buildQueryMock };
});

vi.mock("../db/db.js", () => ({ db: dbMock }));

vi.mock("../utils/match-status.js", () => ({
  getMatchStatus: vi.fn(),
  syncMatchStatus: vi.fn(),
}));

import { matches } from "../db/schema.js";
import { getMatchStatus, syncMatchStatus } from "../utils/match-status.js";
import {
  createMatch,
  listMatches,
  MatchServiceError,
  updateMatchScore,
} from "./matches.js";

beforeEach(() => {
  dbMock.select.mockReset();
  dbMock.insert.mockReset();
  dbMock.update.mockReset();
  vi.mocked(getMatchStatus).mockReset();
  vi.mocked(syncMatchStatus).mockReset();
});

describe("MatchServiceError", () => {
  it("sets the message, name and code", () => {
    const err = new MatchServiceError("boom", "NOT_FOUND");

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
    expect(err.name).toBe("MatchServiceError");
    expect(err.code).toBe("NOT_FOUND");
  });
});

describe("listMatches", () => {
  it("selects from matches ordered by createdAt with the given limit", async () => {
    const rows = [{ id: 1 }];
    const builder = buildQueryMock(rows);
    dbMock.select.mockReturnValue(builder);

    const result = await listMatches(20);

    expect(dbMock.select).toHaveBeenCalledTimes(1);
    expect(builder.from).toHaveBeenCalledWith(matches);
    expect(builder.orderBy).toHaveBeenCalledTimes(1);
    expect(builder.limit).toHaveBeenCalledWith(20);
    expect(result).toBe(rows);
  });

  it("defaults the limit to 50 when none is provided", async () => {
    const builder = buildQueryMock([]);
    dbMock.select.mockReturnValue(builder);

    await listMatches();

    expect(builder.limit).toHaveBeenCalledWith(50);
  });

  it("caps the limit at 100 even when a larger value is requested", async () => {
    const builder = buildQueryMock([]);
    dbMock.select.mockReturnValue(builder);

    await listMatches(500);

    expect(builder.limit).toHaveBeenCalledWith(100);
  });

  it("does not cap a limit that is already within bounds", async () => {
    const builder = buildQueryMock([]);
    dbMock.select.mockReturnValue(builder);

    await listMatches(99);

    expect(builder.limit).toHaveBeenCalledWith(99);
  });
});

describe("createMatch", () => {
  const input = {
    sport: "soccer",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startTime: "2026-01-01T10:00:00.000Z",
    endTime: "2026-01-01T12:00:00.000Z",
  };

  it("throws INVALID_TIMES and never inserts when the status cannot be computed", async () => {
    vi.mocked(getMatchStatus).mockReturnValue(null);

    await expect(createMatch(input)).rejects.toMatchObject({
      name: "MatchServiceError",
      code: "INVALID_TIMES",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("inserts a match with the computed status and default scores", async () => {
    vi.mocked(getMatchStatus).mockReturnValue(MATCH_STATUS.SCHEDULED);
    const inserted = { id: 1, ...input, status: MATCH_STATUS.SCHEDULED };
    const builder = buildQueryMock([inserted]);
    dbMock.insert.mockReturnValue(builder);

    const result = await createMatch(input);

    expect(dbMock.insert).toHaveBeenCalledWith(matches);
    expect(builder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: input.sport,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        homeScore: 0,
        awayScore: 0,
        status: MATCH_STATUS.SCHEDULED,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
      }),
    );
    expect(builder.returning).toHaveBeenCalledTimes(1);
    expect(result).toBe(inserted);
  });

  it("uses provided homeScore/awayScore instead of the defaults", async () => {
    vi.mocked(getMatchStatus).mockReturnValue(MATCH_STATUS.LIVE);
    const builder = buildQueryMock([{ id: 2 }]);
    dbMock.insert.mockReturnValue(builder);

    await createMatch({ ...input, homeScore: 3, awayScore: 1 });

    expect(builder.values).toHaveBeenCalledWith(
      expect.objectContaining({ homeScore: 3, awayScore: 1 }),
    );
  });
});

describe("updateMatchScore", () => {
  const scoreInput = { homeScore: 2, awayScore: 1 };

  it("throws NOT_FOUND when the match does not exist", async () => {
    const selectBuilder = buildQueryMock([]);
    dbMock.select.mockReturnValue(selectBuilder);

    await expect(updateMatchScore(1, scoreInput)).rejects.toMatchObject({
      name: "MatchServiceError",
      code: "NOT_FOUND",
    });
    expect(syncMatchStatus).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("throws NOT_LIVE when the synced status is not live", async () => {
    const existing = {
      id: 1,
      status: MATCH_STATUS.SCHEDULED,
      startTime: new Date(),
      endTime: new Date(),
    };
    dbMock.select.mockReturnValue(buildQueryMock([existing]));
    vi.mocked(syncMatchStatus).mockResolvedValue(MATCH_STATUS.SCHEDULED);

    await expect(updateMatchScore(1, scoreInput)).rejects.toMatchObject({
      name: "MatchServiceError",
      code: "NOT_LIVE",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("updates and returns the score when the match is live", async () => {
    const existing = {
      id: 1,
      status: MATCH_STATUS.LIVE,
      startTime: new Date(),
      endTime: new Date(),
    };
    dbMock.select.mockReturnValue(buildQueryMock([existing]));
    vi.mocked(syncMatchStatus).mockResolvedValue(MATCH_STATUS.LIVE);

    const updatedRow = { id: 1, homeScore: 2, awayScore: 1 };
    const updateBuilder = buildQueryMock([updatedRow]);
    dbMock.update.mockReturnValue(updateBuilder);

    const result = await updateMatchScore(1, scoreInput);

    expect(dbMock.update).toHaveBeenCalledWith(matches);
    expect(updateBuilder.set).toHaveBeenCalledWith({
      homeScore: 2,
      awayScore: 1,
    });
    expect(result).toBe(updatedRow);
  });

  it("persists a status transition via the syncMatchStatus callback before updating the score", async () => {
    const existing: {
      id: number;
      status: string;
      startTime: Date;
      endTime: Date;
    } = {
      id: 1,
      status: MATCH_STATUS.SCHEDULED,
      startTime: new Date(),
      endTime: new Date(),
    };
    dbMock.select.mockReturnValue(buildQueryMock([existing]));

    vi.mocked(syncMatchStatus).mockImplementation(
      async (match: any, updateStatus: any) => {
        await updateStatus(MATCH_STATUS.LIVE);
        match.status = MATCH_STATUS.LIVE;
        return MATCH_STATUS.LIVE;
      },
    );

    const statusUpdateBuilder = buildQueryMock([]);
    const scoreUpdateBuilder = buildQueryMock([
      { id: 1, homeScore: 2, awayScore: 1 },
    ]);
    dbMock.update
      .mockReturnValueOnce(statusUpdateBuilder)
      .mockReturnValueOnce(scoreUpdateBuilder);

    const result = await updateMatchScore(1, scoreInput);

    expect(statusUpdateBuilder.set).toHaveBeenCalledWith({
      status: MATCH_STATUS.LIVE,
    });
    expect(scoreUpdateBuilder.set).toHaveBeenCalledWith({
      homeScore: 2,
      awayScore: 1,
    });
    expect(result).toEqual({ id: 1, homeScore: 2, awayScore: 1 });
  });
});