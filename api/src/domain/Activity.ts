export type ActivityEntityType = "work-item" | "document" | "signal";

/**
 * @description An activity trail entry used to support recent-change understanding.
 */
export interface ActivityEvent {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
  metadata: Record<string, boolean | number | string | null>;
}
