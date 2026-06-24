import { ValidationError } from "../errors/MikroLensError.ts";
import type { DocumentSummary } from "./Document.ts";
import type { HorizonDTO } from "./Horizon.ts";
import type { SpaceDTO } from "./Space.ts";
import type { UserDTO } from "./User.ts";

export type WorkflowState =
  | "Inbox"
  | "Shaping"
  | "Ready"
  | "Active"
  | "Blocked"
  | "Waiting"
  | "Done"
  | "Parked"
  | "Archived";
export type BoardWorkflowState =
  | "Inbox"
  | "Shaping"
  | "Ready"
  | "Active"
  | "Blocked"
  | "Parked"
  | "Waiting"
  | "Done";
export type WorkItemType = "Idea" | "Problem" | "Bug" | "Task" | "Change" | "Decision request";
export type WorkItemSource = "planned" | "unplanned";

/**
 * @description The compact operational record used for intake and execution.
 */
export interface WorkItemDTO {
  id: string;
  ref: string;
  spaceId: string;
  type: WorkItemType;
  title: string;
  summary: string;
  state: WorkflowState;
  horizonId: string;
  ownerName: string | null;
  ownerUserIds: string[];
  targetStartDate: string | null;
  targetEndDate: string | null;
  source: WorkItemSource;
  blockedReason: string;
  roadmapRelevance: boolean;
  createdAt: string;
  updatedAt: string;
  lastTouchedAt: string;
  completedAt: string | null;
}

const DEFAULT_SUMMARY = "";
export const workflowStates = [
  "Inbox",
  "Shaping",
  "Ready",
  "Active",
  "Blocked",
  "Parked",
  "Waiting",
  "Done",
  "Archived",
] as const;
export const boardWorkflowStates = [
  "Inbox",
  "Shaping",
  "Ready",
  "Active",
  "Blocked",
  "Parked",
  "Waiting",
  "Done",
] as const;
export const workItemTypes = [
  "Idea",
  "Problem",
  "Bug",
  "Task",
  "Change",
  "Decision request",
] as const;
export const workItemSources = ["planned", "unplanned"] as const;
const staleThresholdDays = {
  Active: 8,
  Archived: 365,
  Blocked: 5,
  Done: 30,
  Inbox: 7,
  Parked: 45,
  Ready: 10,
  Shaping: 14,
  Waiting: 5,
} as const;

/**
 * @description Enriched operational record returned by the API.
 */
export interface WorkItemRecord extends WorkItemDTO {
  ageDays: number;
  horizon: HorizonDTO;
  isBlocked: boolean;
  isStale: boolean;
  linkedDocuments: DocumentSummary[];
  owners: UserDTO[];
  space: SpaceDTO;
}

export interface CreateWorkItemInput {
  horizonId: string;
  id: string;
  now: string;
  ownerName?: string | null;
  ownerUserIds?: string[];
  ref: string;
  source?: WorkItemSource;
  spaceId: string;
  state?: WorkflowState;
  summary?: string;
  targetEndDate?: string | null;
  targetStartDate?: string | null;
  title: string;
  type?: WorkItemType;
}

export interface ApplyWorkItemUpdateInput {
  blockedReason?: string;
  horizonId?: string;
  now: string;
  ownerName?: string | null;
  ownerUserIds?: string[];
  state?: WorkflowState;
  summary?: string;
  targetEndDate?: string | null;
  targetStartDate?: string | null;
  title?: string;
  type?: WorkItemType;
}

export class WorkItem {
  private readonly dto: WorkItemDTO;

  private constructor(dto: WorkItemDTO) {
    this.dto = dto;
  }

  static create(input: CreateWorkItemInput): WorkItem {
    const now = requireText(input.now, "Work item timestamp is required.");
    const type = input.type ?? "Task";
    const state = input.state ?? "Inbox";
    const targetDates = resolveTargetDates(input.targetStartDate, input.targetEndDate);

    return new WorkItem({
      blockedReason: "",
      completedAt: state === "Done" ? now : null,
      createdAt: now,
      horizonId: requireText(input.horizonId, "Work item horizon is required."),
      id: requireText(input.id, "Work item id is required."),
      lastTouchedAt: now,
      ownerName: normalizeNullableText(input.ownerName),
      ownerUserIds: normalizeStringList(input.ownerUserIds),
      ref: requireText(input.ref, "Work item reference is required."),
      roadmapRelevance: isRoadmapRelevantType(type),
      source: input.source ?? "planned",
      spaceId: requireText(input.spaceId, "Work item space is required."),
      state,
      summary: normalizeSummary(input.summary),
      targetEndDate: targetDates.targetEndDate,
      targetStartDate: targetDates.targetStartDate,
      title: requireText(input.title, "Work item title is required."),
      type,
      updatedAt: now,
    });
  }

  static rehydrate(dto: WorkItemDTO): WorkItem {
    return new WorkItem({ ...dto });
  }

  applyOperationalUpdate(input: ApplyWorkItemUpdateInput): WorkItem {
    const nextState = input.state ?? this.dto.state;
    const nextType = input.type ?? this.dto.type;
    const targetDates = resolveTargetDates(
      input.targetStartDate,
      input.targetEndDate,
      this.dto.targetStartDate,
      this.dto.targetEndDate,
    );

    return new WorkItem({
      ...this.dto,
      blockedReason: nextState === "Blocked" ? (input.blockedReason ?? this.dto.blockedReason) : "",
      completedAt: resolveCompletedAt(this.dto.completedAt, input.state, nextState, input.now),
      horizonId: input.horizonId ?? this.dto.horizonId,
      lastTouchedAt: requireText(input.now, "Work item timestamp is required."),
      ownerName:
        input.ownerName === undefined ? this.dto.ownerName : normalizeNullableText(input.ownerName),
      ownerUserIds:
        input.ownerUserIds === undefined
          ? [...this.dto.ownerUserIds]
          : normalizeStringList(input.ownerUserIds),
      roadmapRelevance: isRoadmapRelevantType(nextType),
      state: nextState,
      summary: resolveText(input.summary, this.dto.summary),
      targetEndDate: targetDates.targetEndDate,
      targetStartDate: targetDates.targetStartDate,
      title: resolveText(input.title, this.dto.title),
      type: nextType,
      updatedAt: requireText(input.now, "Work item timestamp is required."),
    });
  }

  toDTO(): WorkItemDTO {
    return { ...this.dto };
  }
}

/**
 * @description Create a whole-number age in days for human-readable work health.
 */
export function ageInDays(fromDate: string, now = new Date()): number {
  const milliseconds = now.getTime() - new Date(fromDate).getTime();
  return Math.max(0, Math.floor(milliseconds / 86_400_000));
}

/**
 * @description Return whether an item is operationally blocked.
 */
export function isBlocked(item: Pick<WorkItemDTO, "blockedReason" | "state">): boolean {
  return item.state === "Blocked";
}

/**
 * @description Return whether a work item should be surfaced as stale.
 */
export function isStale(
  item: Pick<WorkItemDTO, "lastTouchedAt" | "state">,
  now = new Date(),
): boolean {
  const threshold = staleThresholdDays[item.state];
  return ageInDays(item.lastTouchedAt, now) >= threshold;
}

/**
 * @description Return the staleness threshold for a workflow state.
 */
export function getStaleThresholdDays(state: WorkflowState): number {
  return staleThresholdDays[state];
}

/**
 * @description Narrow a free-form string to a valid workflow state.
 */
export function isWorkflowState(value: string): value is WorkflowState {
  return workflowStates.includes(value as WorkflowState);
}

/**
 * @description Narrow a free-form string to a valid work item type.
 */
export function isWorkItemType(value: string): value is WorkItemType {
  return workItemTypes.includes(value as WorkItemType);
}

/**
 * @description Narrow a free-form string to a valid work item source.
 */
export function isWorkItemSource(value: string): value is WorkItemSource {
  return workItemSources.includes(value as WorkItemSource);
}

function normalizeSummary(value?: string): string {
  return value?.trim() || DEFAULT_SUMMARY;
}

function normalizeNullableText(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function normalizeOptionalDate(value?: string | null): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ValidationError("Target dates must use YYYY-MM-DD.");
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new ValidationError("Target dates must be valid calendar dates.");
  }

  return trimmed;
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(message);
  }

  return trimmed;
}

function resolveTargetDates(
  targetStartDate?: string | null,
  targetEndDate?: string | null,
  currentTargetStartDate: string | null = null,
  currentTargetEndDate: string | null = null,
): { targetStartDate: string | null; targetEndDate: string | null } {
  const nextTargetStartDate = normalizeOptionalDate(targetStartDate);
  const nextTargetEndDate = normalizeOptionalDate(targetEndDate);
  const resolvedTargetStartDate =
    nextTargetStartDate === undefined ? currentTargetStartDate : nextTargetStartDate;
  const resolvedTargetEndDate =
    nextTargetEndDate === undefined ? currentTargetEndDate : nextTargetEndDate;

  if (
    resolvedTargetStartDate &&
    resolvedTargetEndDate &&
    resolvedTargetStartDate > resolvedTargetEndDate
  ) {
    throw new ValidationError("Target end date must be on or after target start date.");
  }

  return {
    targetEndDate: resolvedTargetEndDate,
    targetStartDate: resolvedTargetStartDate,
  };
}

function resolveCompletedAt(
  currentValue: string | null,
  requestedState: WorkflowState | undefined,
  nextState: WorkflowState,
  now: string,
): string | null {
  if (nextState === "Done") {
    return currentValue ?? requireText(now, "Work item timestamp is required.");
  }

  if (requestedState && currentValue) {
    return null;
  }

  return currentValue;
}

function resolveText(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function isRoadmapRelevantType(type: WorkItemType): boolean {
  return type === "Change" || type === "Problem";
}
