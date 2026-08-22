import { MATCH_STATUS } from "../validation/matches.js";

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

type DateInput = Date | number | string;

type SyncableMatch = {
  startTime: DateInput | null;
  endTime: DateInput | null;
  status: MatchStatus;
};

export function getMatchStatus(
  startTime: DateInput | null | undefined,
  endTime: DateInput | null | undefined,
  now = new Date(),
): MatchStatus | null {
  if (startTime == null || endTime == null) {
    return null;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (now < start) {
    return MATCH_STATUS.SCHEDULED;
  }

  if (now >= end) {
    return MATCH_STATUS.FINISHED;
  }

  return MATCH_STATUS.LIVE;
}

export async function syncMatchStatus(
  match: SyncableMatch,
  updateStatus: (status: MatchStatus) => void | Promise<void>,
) {
  const nextStatus = getMatchStatus(match.startTime, match.endTime);
  if (!nextStatus) {
    return match.status;
  }
  if (match.status !== nextStatus) {
    await updateStatus(nextStatus);
    match.status = nextStatus;
  }
  return match.status;
}
