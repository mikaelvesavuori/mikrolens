import type { WorkItemFilters } from "../queries/WorkItemFilters.ts";

export type SavedViewScope = "Understand" | "Direct" | "Plan" | "Work";

/**
 * @description A saved application view preset over work, planning, or system understanding.
 */
export interface SavedView {
  id: string;
  name: string;
  description: string;
  scope: SavedViewScope;
  accent: string;
  filters: WorkItemFilters;
  createdAt: string;
  updatedAt: string;
}
