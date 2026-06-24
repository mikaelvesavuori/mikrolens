import type { HorizonKey } from "../../domain/Horizon.ts";
import type { WorkflowState, WorkItemSource, WorkItemType } from "../../domain/WorkItem.ts";

export type WorkItemSortField =
  | "createdAt"
  | "ref"
  | "state"
  | "targetEndDate"
  | "title"
  | "updatedAt";
export type QuerySortDirection = "asc" | "desc";

/**
 * @description Shared filters used to persist and apply work-focused views.
 */
export interface WorkItemFilters {
  blocked?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  horizonKey?: HorizonKey;
  horizonName?: string;
  onlyRoadmap?: boolean;
  ownerName?: string;
  ownerUserId?: string;
  spaceId?: string;
  stale?: boolean;
  state?: WorkflowState;
  source?: WorkItemSource;
  targetEndAfter?: string;
  targetEndBefore?: string;
  type?: WorkItemType;
  updatedAfter?: string;
  updatedBefore?: string;
}

/**
 * @description Work-item filters plus transient search input from HTTP requests.
 */
export interface WorkItemQueryFilters extends WorkItemFilters {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: WorkItemSortField;
  sortDirection?: QuerySortDirection;
}
