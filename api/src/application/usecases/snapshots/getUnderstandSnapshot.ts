import type { AccessPolicy } from "../../../domain/AccessPolicy.ts";
import type { WorkItemRecord } from "../../../domain/WorkItem.ts";
import { ageInDays, getStaleThresholdDays } from "../../../domain/WorkItem.ts";
import type { LedgerRepository } from "../../ports/MikroLensRepository.ts";
import { buildRecentActivity, buildWorkItemRecords } from "../../queries/LedgerReadModels.ts";
import type { UnderstandSnapshot } from "../../readModels/UnderstandSnapshot.ts";

/**
 * @description Build the systemic understanding view for the current ledger state.
 */
export function getUnderstandSnapshot(
  repository: LedgerRepository,
  spaceId?: string,
  accessPolicy: AccessPolicy | null = null,
): UnderstandSnapshot {
  const ledger = repository.getLedger();
  const records = buildWorkItemRecords(ledger, { spaceId }, accessPolicy).filter(
    (record) => record.state !== "Archived",
  );
  const openRecords = records.filter((record) => !["Done", "Archived"].includes(record.state));
  const today = formatLocalDateKey(new Date());

  const blockedRecords = openRecords.filter((record) => record.isBlocked);
  const staleRecords = openRecords.filter((record) => record.isStale);
  const pastTargetRecords = openRecords.filter(
    (record) => record.targetEndDate && record.targetEndDate < today,
  );

  const blockedItems = blockedRecords
    .toSorted((left, right) => compareBlockedPressure(left, right, today))
    .slice(0, 6);

  const staleItems = staleRecords
    .toSorted((left, right) => compareStalePressure(left, right))
    .slice(0, 6);

  const pastTargetItems = pastTargetRecords
    .toSorted((left, right) => comparePastTargetPressure(left, right, today))
    .slice(0, 6);

  const counts = {
    blocked: blockedRecords.length,
    inboxDebt: records.filter((record) => record.state === "Inbox" && record.ageDays >= 7).length,
    needsOwner: openRecords.filter((record) => record.owners.length === 0 && !record.ownerName)
      .length,
    pastTarget: pastTargetRecords.length,
    stale: staleRecords.length,
    unplannedOpen: openRecords.filter((record) => record.source === "unplanned").length,
  };

  return {
    counts,
    blockedItems,
    pastTargetItems,
    metrics: [
      {
        detail:
          counts.inboxDebt === 0
            ? "Inbox is under control."
            : "Items older than 7 days still sit in Inbox.",
        label: "Inbox debt",
        value: String(counts.inboxDebt),
      },
      {
        detail:
          counts.blocked === 0
            ? "Nothing is currently blocked."
            : "Work currently needs external movement.",
        label: "Blocked now",
        value: String(counts.blocked),
      },
      {
        detail:
          counts.stale === 0
            ? "Nothing is aging badly."
            : "Touched too infrequently for the current state.",
        label: "Stale items",
        value: String(counts.stale),
      },
      {
        detail:
          counts.pastTarget === 0
            ? "Nothing has slipped past its target end date."
            : "Items still open after the target window closed.",
        label: "Past target",
        value: String(counts.pastTarget),
      },
      {
        detail:
          counts.unplannedOpen === 0
            ? "Open work is currently coming through planned lanes."
            : "Open work that entered outside the planned path.",
        label: "Unplanned open",
        value: String(counts.unplannedOpen),
      },
      {
        detail:
          counts.needsOwner === 0
            ? "Open work has an owner signal."
            : "Open items still lack a named owner.",
        label: "Needs owner",
        value: String(counts.needsOwner),
      },
    ],
    recentChanges: buildRecentActivity(ledger, spaceId, accessPolicy).slice(0, 8),
    resolutionDistribution: buildResolutionDistribution(records),
    staleItems,
    waitDistribution: buildWaitDistribution(records),
  };
}

function buildWaitDistribution(
  records: WorkItemRecord[],
): Array<{ bucket: string; count: number }> {
  const buckets = [
    { count: 0, label: "0-2d" },
    { count: 0, label: "3-5d" },
    { count: 0, label: "6-10d" },
    { count: 0, label: ">10d" },
  ];

  for (const record of records.filter((item) => item.state === "Waiting")) {
    const age = ageInDays(record.lastTouchedAt);

    if (age <= 2) {
      buckets[0].count += 1;
    } else if (age <= 5) {
      buckets[1].count += 1;
    } else if (age <= 10) {
      buckets[2].count += 1;
    } else {
      buckets[3].count += 1;
    }
  }

  return buckets.map((bucket) => ({ bucket: bucket.label, count: bucket.count }));
}

function buildResolutionDistribution(
  records: WorkItemRecord[],
): Array<{ bucket: string; count: number }> {
  const buckets = [
    { count: 0, label: "0-3d" },
    { count: 0, label: "4-7d" },
    { count: 0, label: "8-14d" },
    { count: 0, label: ">14d" },
  ];

  for (const record of records.filter((item) => item.completedAt)) {
    const completedAt = record.completedAt;

    if (!completedAt) {
      continue;
    }

    const cycleTime = ageInDays(record.createdAt, new Date(completedAt));

    if (cycleTime <= 3) {
      buckets[0].count += 1;
    } else if (cycleTime <= 7) {
      buckets[1].count += 1;
    } else if (cycleTime <= 14) {
      buckets[2].count += 1;
    } else {
      buckets[3].count += 1;
    }
  }

  return buckets.map((bucket) => ({ bucket: bucket.label, count: bucket.count }));
}

function compareBlockedPressure(
  left: WorkItemRecord,
  right: WorkItemRecord,
  today: string,
): number {
  const latenessRank = daysPastTarget(right, today) - daysPastTarget(left, today);

  if (latenessRank !== 0) {
    return latenessRank;
  }

  const touchRank = ageInDays(right.lastTouchedAt) - ageInDays(left.lastTouchedAt);

  if (touchRank !== 0) {
    return touchRank;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function comparePastTargetPressure(
  left: WorkItemRecord,
  right: WorkItemRecord,
  today: string,
): number {
  const latenessRank = daysPastTarget(right, today) - daysPastTarget(left, today);

  if (latenessRank !== 0) {
    return latenessRank;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareStalePressure(left: WorkItemRecord, right: WorkItemRecord): number {
  const staleRank = staleSeverity(right) - staleSeverity(left);

  if (staleRank !== 0) {
    return staleRank;
  }

  return ageInDays(right.lastTouchedAt) - ageInDays(left.lastTouchedAt);
}

function daysPastTarget(record: WorkItemRecord, today: string): number {
  if (!record.targetEndDate || record.targetEndDate >= today) {
    return 0;
  }

  return ageInDays(`${record.targetEndDate}T00:00:00`, new Date(`${today}T00:00:00`));
}

function staleSeverity(record: WorkItemRecord): number {
  return ageInDays(record.lastTouchedAt) - getStaleThresholdDays(record.state);
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
