import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMatchStatus, syncMatchStatus } from "./match-status.js";
import { MATCH_STATUS } from "../validation/matches.js";

describe("getMatchStatus", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("returns null when startTime is null", () => {
    expect(getMatchStatus(null, "2026-01-01T13:00:00.000Z", now)).toBeNull();
  });

  it("returns null when endTime is null", () => {
    expect(getMatchStatus("2026-01-01T11:00:00.000Z", null, now)).toBeNull();
  });

  it("returns null when startTime is undefined", () => {
    expect(
      getMatchStatus(undefined, "2026-01-01T13:00:00.000Z", now),
    ).toBeNull();
  });

  it("returns null when endTime is undefined", () => {
    expect(
      getMatchStatus("2026-01-01T11:00:00.000Z", undefined, now),
    ).toBeNull();
  });

  it("returns null when startTime is an unparsable string", () => {
    expect(
      getMatchStatus("not-a-date", "2026-01-01T13:00:00.000Z", now),
    ).toBeNull();
  });

  it("returns null when endTime is an unparsable string", () => {
    expect(
      getMatchStatus("2026-01-01T11:00:00.000Z", "not-a-date", now),
    ).toBeNull();
  });

  it("returns SCHEDULED when now is before startTime", () => {
    const status = getMatchStatus(
      "2026-01-01T13:00:00.000Z",
      "2026-01-01T15:00:00.000Z",
      now,
    );
    expect(status).toBe(MATCH_STATUS.SCHEDULED);
  });

  it("returns LIVE when now is between startTime and endTime", () => {
    const status = getMatchStatus(
      "2026-01-01T11:00:00.000Z",
      "2026-01-01T13:00:00.000Z",
      now,
    );
    expect(status).toBe(MATCH_STATUS.LIVE);
  });

  it("returns LIVE when now exactly equals startTime", () => {
    const status = getMatchStatus(
      "2026-01-01T12:00:00.000Z",
      "2026-01-01T13:00:00.000Z",
      now,
    );
    expect(status).toBe(MATCH_STATUS.LIVE);
  });

  it("returns FINISHED when now is after endTime", () => {
    const status = getMatchStatus(
      "2026-01-01T10:00:00.000Z",
      "2026-01-01T11:00:00.000Z",
      now,
    );
    expect(status).toBe(MATCH_STATUS.FINISHED);
  });

  it("returns FINISHED when now exactly equals endTime", () => {
    const status = getMatchStatus(
      "2026-01-01T10:00:00.000Z",
      "2026-01-01T12:00:00.000Z",
      now,
    );
    expect(status).toBe(MATCH_STATUS.FINISHED);
  });

  it("accepts Date objects as input", () => {
    const status = getMatchStatus(
      new Date("2026-01-01T11:00:00.000Z"),
      new Date("2026-01-01T13:00:00.000Z"),
      now,
    );
    expect(status).toBe(MATCH_STATUS.LIVE);
  });

  it("accepts numeric timestamps as input", () => {
    const status = getMatchStatus(
      new Date("2026-01-01T11:00:00.000Z").getTime(),
      new Date("2026-01-01T13:00:00.000Z").getTime(),
      now,
    );
    expect(status).toBe(MATCH_STATUS.LIVE);
  });

  it("defaults now to the current time when omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    try {
      const status = getMatchStatus(
        "2026-01-01T11:00:00.000Z",
        "2026-01-01T13:00:00.000Z",
      );
      expect(status).toBe(MATCH_STATUS.LIVE);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("syncMatchStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call updateStatus when the computed status is unchanged", async () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const match = {
      startTime: "2026-01-01T11:00:00.000Z",
      endTime: "2026-01-01T13:00:00.000Z",
      status: MATCH_STATUS.LIVE,
    };
    const updateStatus = vi.fn();

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(MATCH_STATUS.LIVE);
    expect(match.status).toBe(MATCH_STATUS.LIVE);
  });

  it("calls updateStatus and mutates the match when the status has changed", async () => {
    vi.setSystemTime(new Date("2026-01-01T14:00:00.000Z"));
    const match = {
      startTime: "2026-01-01T11:00:00.000Z",
      endTime: "2026-01-01T13:00:00.000Z",
      status: MATCH_STATUS.LIVE,
    };
    const updateStatus = vi.fn();

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith(MATCH_STATUS.FINISHED);
    expect(match.status).toBe(MATCH_STATUS.FINISHED);
    expect(result).toBe(MATCH_STATUS.FINISHED);
  });

  it("awaits an async updateStatus callback before resolving", async () => {
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
    const match = {
      startTime: "2026-01-01T11:00:00.000Z",
      endTime: "2026-01-01T13:00:00.000Z",
      status: MATCH_STATUS.LIVE,
    };
    let resolved = false;
    const updateStatus = vi.fn(async () => {
      await Promise.resolve();
      resolved = true;
    });

    const result = await syncMatchStatus(match, updateStatus);

    expect(resolved).toBe(true);
    expect(result).toBe(MATCH_STATUS.SCHEDULED);
  });

  it("returns the existing status without calling updateStatus when dates are invalid", async () => {
    const match = {
      startTime: "not-a-date",
      endTime: "also-not-a-date",
      status: MATCH_STATUS.SCHEDULED,
    };
    const updateStatus = vi.fn();

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(MATCH_STATUS.SCHEDULED);
  });

  it("returns the existing status without calling updateStatus when startTime/endTime are null", async () => {
    const match = {
      startTime: null,
      endTime: null,
      status: MATCH_STATUS.FINISHED,
    };
    const updateStatus = vi.fn();

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(MATCH_STATUS.FINISHED);
  });
});