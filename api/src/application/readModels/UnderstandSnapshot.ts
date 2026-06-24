import type { ActivityEvent } from "../../domain/Activity.ts";
import type { WorkItemRecord } from "../../domain/WorkItem.ts";

/**
 * @description The core metric shown in Understand.
 */
export interface MetricCard {
  label: string;
  value: string;
  detail: string;
}

export interface UnderstandCounts {
  blocked: number;
  inboxDebt: number;
  needsOwner: number;
  pastTarget: number;
  stale: number;
  unplannedOpen: number;
}

/**
 * @description The aggregated system-understanding payload.
 */
export interface UnderstandSnapshot {
  counts: UnderstandCounts;
  metrics: MetricCard[];
  recentChanges: ActivityEvent[];
  blockedItems: WorkItemRecord[];
  pastTargetItems: WorkItemRecord[];
  staleItems: WorkItemRecord[];
  waitDistribution: Array<{ bucket: string; count: number }>;
  resolutionDistribution: Array<{ bucket: string; count: number }>;
}
