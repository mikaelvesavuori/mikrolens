import {
  type AccessPolicy,
  canAccessBoard,
  canAccessDocuments,
  canAccessSignals,
} from "../../domain/AccessPolicy.ts";
import type { ActivityEvent } from "../../domain/Activity.ts";
import type { DocumentSummary } from "../../domain/Document.ts";
import type { SignalRecord } from "../../domain/Signal.ts";
import type { WorkItemRecord } from "../../domain/WorkItem.ts";
import { ageInDays, isBlocked, isStale } from "../../domain/WorkItem.ts";
import type { LedgerData } from "../ports/MikroLensRepository.ts";
import type {
  QuerySortDirection,
  WorkItemQueryFilters,
  WorkItemSortField,
} from "./WorkItemFilters.ts";

/**
 * @description Build the enriched document list used by Direct, Plan, and work links.
 */
export function buildDocumentSummaries(
  ledger: LedgerData,
  filters: { spaceId?: string } = {},
  accessPolicy: AccessPolicy | null = null,
): DocumentSummary[] {
  if (accessPolicy && !canAccessDocuments(accessPolicy, "viewer")) {
    return [];
  }

  const spacesById = new Map(ledger.spaces.map((space) => [space.id, space]));
  const horizonsById = new Map(ledger.horizons.map((horizon) => [horizon.id, horizon]));

  return ledger.documents
    .filter((document) =>
      filters.spaceId ? document.spaceId === filters.spaceId || document.spaceId === null : true,
    )
    .map((document) => {
      const horizon = document.horizonId ? (horizonsById.get(document.horizonId) ?? null) : null;
      const space = document.spaceId ? (spacesById.get(document.spaceId) ?? null) : null;

      return {
        horizonKey: horizon?.key ?? null,
        horizonName: horizon?.name ?? null,
        id: document.id,
        spaceId: document.spaceId,
        spaceName: space?.name ?? null,
        summary: getDocumentDisplaySummary(document),
        title: document.title,
        type: document.type,
      } satisfies DocumentSummary;
    })
    .sort((left, right) => right.title.localeCompare(left.title) * -1);
}

function getDocumentDisplaySummary(document: LedgerData["documents"][number]): string {
  const explicitSummary = document.summary.trim();

  if (explicitSummary && explicitSummary !== "Fresh document draft.") {
    return explicitSummary;
  }

  const lines = document.markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidate = lines.find(
    (line) =>
      !line.startsWith("#") &&
      !line.startsWith("- ") &&
      !line.startsWith("* ") &&
      !line.startsWith(">") &&
      line !== "Start writing here.",
  );

  return candidate ?? "";
}

/**
 * @description Build the enriched work list used by Work, Understand, and Plan.
 */
export function buildWorkItemRecords(
  ledger: LedgerData,
  filters: WorkItemQueryFilters = {},
  accessPolicy: AccessPolicy | null = null,
): WorkItemRecord[] {
  const spacesById = new Map(ledger.spaces.map((space) => [space.id, space]));
  const horizonsById = new Map(ledger.horizons.map((horizon) => [horizon.id, horizon]));
  const usersById = new Map(ledger.users.map((user) => [user.id, user]));
  const documentsById = new Map(
    buildDocumentSummaries(ledger, {}, accessPolicy).map((document) => [document.id, document]),
  );
  const linkedDocumentsByWorkItemId = new Map<string, DocumentSummary[]>();

  for (const link of ledger.documentLinks) {
    const existing = linkedDocumentsByWorkItemId.get(link.workItemId) ?? [];
    const document = documentsById.get(link.documentId);

    if (document) {
      existing.push(document);
      linkedDocumentsByWorkItemId.set(link.workItemId, existing);
    }
  }

  const records = ledger.workItems
    .filter((item) => {
      if (accessPolicy && !canAccessBoard(accessPolicy, item.spaceId, "viewer")) {
        return false;
      }

      if (filters.spaceId && item.spaceId !== filters.spaceId) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const horizon = horizonsById.get(item.horizonId);
      const space = spacesById.get(item.spaceId);
      const owners = item.ownerUserIds
        .map((ownerUserId) => usersById.get(ownerUserId) ?? null)
        .filter((owner): owner is LedgerData["users"][number] => Boolean(owner));
      const ownerName =
        owners.map((owner) => getUserDisplayName(owner)).join(", ") || item.ownerName || null;

      if (!horizon || !space) {
        throw new Error(`Missing joined data for work item ${item.id}`);
      }

      return {
        ...item,
        ageDays: ageInDays(item.createdAt),
        horizon,
        isBlocked: isBlocked(item),
        isStale: isStale(item),
        linkedDocuments: linkedDocumentsByWorkItemId.get(item.id) ?? [],
        ownerName,
        owners,
        space,
      } satisfies WorkItemRecord;
    })
    .filter((record) => {
      if (filters.state && record.state !== filters.state) {
        return false;
      }

      if (filters.type && record.type !== filters.type) {
        return false;
      }

      if (filters.ownerName && record.ownerName !== filters.ownerName) {
        return false;
      }

      if (filters.ownerUserId && !record.ownerUserIds.includes(filters.ownerUserId)) {
        return false;
      }

      if (filters.horizonName && record.horizon.name !== filters.horizonName) {
        return false;
      }

      if (filters.horizonKey && record.horizon.key !== filters.horizonKey) {
        return false;
      }

      if (filters.blocked !== undefined && record.isBlocked !== filters.blocked) {
        return false;
      }

      if (filters.stale !== undefined && record.isStale !== filters.stale) {
        return false;
      }

      if (filters.onlyRoadmap !== undefined && record.roadmapRelevance !== filters.onlyRoadmap) {
        return false;
      }

      if (filters.search) {
        const haystack = [
          record.ref,
          record.title,
          record.summary,
          record.space.name,
          record.ownerName ?? "",
          record.linkedDocuments.map((document) => document.title).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(filters.search.toLowerCase())) {
          return false;
        }
      }

      if (filters.source && record.source !== filters.source) {
        return false;
      }

      if (filters.createdAfter && record.createdAt < filters.createdAfter) {
        return false;
      }

      if (filters.createdBefore && record.createdAt > filters.createdBefore) {
        return false;
      }

      if (filters.updatedAfter && record.updatedAt < filters.updatedAfter) {
        return false;
      }

      if (filters.updatedBefore && record.updatedAt > filters.updatedBefore) {
        return false;
      }

      if (
        filters.targetEndAfter &&
        (!record.targetEndDate || record.targetEndDate < filters.targetEndAfter)
      ) {
        return false;
      }

      if (
        filters.targetEndBefore &&
        (!record.targetEndDate || record.targetEndDate > filters.targetEndBefore)
      ) {
        return false;
      }

      return true;
    });

  return records.sort((left, right) =>
    sortWorkItemRecords(left, right, filters.sortBy, filters.sortDirection),
  );
}

function getUserDisplayName(user: LedgerData["users"][number]): string {
  const name = user.name?.trim();

  if (name) {
    return name;
  }

  return user.email.split("@")[0] ?? user.email;
}

/**
 * @description Build the enriched signal list used by the Intake view.
 */
export function buildSignalRecords(
  ledger: LedgerData,
  accessPolicy: AccessPolicy | null = null,
): SignalRecord[] {
  if (accessPolicy && !canAccessSignals(accessPolicy, "viewer")) {
    return [];
  }

  const spacesById = new Map(ledger.spaces.map((space) => [space.id, space]));
  const workItemsById = new Map(ledger.workItems.map((item) => [item.id, item]));

  return ledger.signals
    .map((signal) => {
      const pulledIntoWorkItem = signal.pulledIntoWorkItemId
        ? (workItemsById.get(signal.pulledIntoWorkItemId) ?? null)
        : null;
      const canSeePulledIntoSpace =
        !accessPolicy ||
        !pulledIntoWorkItem ||
        canAccessBoard(accessPolicy, pulledIntoWorkItem.spaceId, "viewer");

      return {
        ...signal,
        ageDays: ageInDays(signal.createdAt),
        isStale: ageInDays(signal.updatedAt) >= 7 && signal.status === "Open",
        pulledIntoSpace:
          pulledIntoWorkItem && canSeePulledIntoSpace
            ? (spacesById.get(pulledIntoWorkItem.spaceId) ?? null)
            : null,
        pulledIntoWorkItemRef: canSeePulledIntoSpace ? (pulledIntoWorkItem?.ref ?? null) : null,
      } satisfies SignalRecord;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

/**
 * @description Build a filtered recent-change feed for Understand.
 */
export function buildRecentActivity(
  ledger: LedgerData,
  spaceId?: string,
  accessPolicy: AccessPolicy | null = null,
): ActivityEvent[] {
  if (!spaceId) {
    return ledger.activity
      .filter(
        (event) =>
          isMeaningfulActivityEvent(event) && canAccessActivityEvent(ledger, event, accessPolicy),
      )
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const workItemsById = new Map(ledger.workItems.map((workItem) => [workItem.id, workItem]));
  const documentsById = new Map(ledger.documents.map((document) => [document.id, document]));

  return ledger.activity
    .filter((event) => {
      if (!isMeaningfulActivityEvent(event)) {
        return false;
      }

      if (!canAccessActivityEvent(ledger, event, accessPolicy)) {
        return false;
      }

      if (event.entityType === "work-item") {
        return workItemsById.get(event.entityId)?.spaceId === spaceId;
      }

      if (event.entityType === "signal") {
        return event.metadata.targetSpaceId === spaceId;
      }

      return documentsById.get(event.entityId)?.spaceId === spaceId;
    })
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function isMeaningfulActivityEvent(event: ActivityEvent): boolean {
  return [
    "document.created",
    "document.linked",
    "document.unlinked",
    "document.updated",
    "state.changed",
    "signal.created",
    "signal.pulled",
    "work-item.created",
  ].includes(event.action);
}

/**
 * @description Find a single work item record by id in enriched form.
 */
export function findWorkItemRecord(
  ledger: LedgerData,
  workItemId: string,
  accessPolicy: AccessPolicy | null = null,
): WorkItemRecord | null {
  return (
    buildWorkItemRecords(ledger, {}, accessPolicy).find((record) => record.id === workItemId) ??
    null
  );
}

/**
 * @description Find a single signal record by id in enriched form.
 */
export function findSignalRecord(
  ledger: LedgerData,
  signalId: string,
  accessPolicy: AccessPolicy | null = null,
): SignalRecord | null {
  return buildSignalRecords(ledger, accessPolicy).find((record) => record.id === signalId) ?? null;
}

function sortWorkItemRecords(
  left: WorkItemRecord,
  right: WorkItemRecord,
  sortBy?: WorkItemSortField,
  sortDirection: QuerySortDirection = "desc",
): number {
  if (sortBy) {
    const comparison = compareBySortField(left, right, sortBy);

    if (comparison !== 0) {
      return sortDirection === "asc" ? comparison : comparison * -1;
    }
  }

  const stateRank = stateSortIndex(left.state) - stateSortIndex(right.state);

  if (stateRank !== 0) {
    return stateRank;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function stateSortIndex(state: WorkItemRecord["state"]): number {
  const ranks = [
    "Inbox",
    "Shaping",
    "Ready",
    "Active",
    "Blocked",
    "Waiting",
    "Done",
    "Parked",
    "Archived",
  ];
  return ranks.indexOf(state);
}

function compareBySortField(
  left: WorkItemRecord,
  right: WorkItemRecord,
  sortBy: WorkItemSortField,
): number {
  switch (sortBy) {
    case "createdAt":
      return left.createdAt.localeCompare(right.createdAt);
    case "ref":
      return left.ref.localeCompare(right.ref);
    case "state":
      return stateSortIndex(left.state) - stateSortIndex(right.state);
    case "targetEndDate":
      return compareNullableText(left.targetEndDate, right.targetEndDate);
    case "title":
      return left.title.localeCompare(right.title);
    case "updatedAt":
      return left.updatedAt.localeCompare(right.updatedAt);
    default:
      return 0;
  }
}

function compareNullableText(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left.localeCompare(right);
}

function canAccessActivityEvent(
  ledger: LedgerData,
  event: ActivityEvent,
  accessPolicy: AccessPolicy | null,
): boolean {
  if (!accessPolicy) {
    return true;
  }

  const workItemsById = new Map(ledger.workItems.map((workItem) => [workItem.id, workItem]));
  const documentsById = new Map(ledger.documents.map((document) => [document.id, document]));

  if (event.entityType === "work-item") {
    const workItem = workItemsById.get(event.entityId);
    return Boolean(workItem && canAccessBoard(accessPolicy, workItem.spaceId, "viewer"));
  }

  if (event.entityType === "document") {
    return canAccessDocuments(accessPolicy, "viewer");
  }

  if (event.entityType === "signal") {
    if (!canAccessSignals(accessPolicy, "viewer")) {
      return false;
    }

    const targetSpaceId = String(event.metadata.targetSpaceId ?? "").trim();

    if (!targetSpaceId) {
      return true;
    }

    return canAccessBoard(accessPolicy, targetSpaceId, "viewer");
  }

  const document = documentsById.get(event.entityId);

  if (!document) {
    return false;
  }

  return canAccessDocuments(accessPolicy, "viewer");
}
