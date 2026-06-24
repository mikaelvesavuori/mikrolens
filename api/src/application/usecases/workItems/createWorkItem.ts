import { defaultHorizonKey } from "../../../domain/Horizon.ts";
import type {
  WorkflowState,
  WorkItemDTO,
  WorkItemRecord,
  WorkItemSource,
  WorkItemType,
} from "../../../domain/WorkItem.ts";
import { WorkItem } from "../../../domain/WorkItem.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { WorkItemCreationRepository } from "../../ports/MikroLensRepository.ts";
import { findHorizon, findSpace } from "../../queries/LedgerLookups.ts";
import { findWorkItemRecord } from "../../queries/LedgerReadModels.ts";

export interface CreateWorkItemInput {
  horizonId?: string;
  ownerName?: string | null;
  ownerUserIds?: string[];
  source?: WorkItemSource;
  spaceId: string;
  state?: WorkflowState;
  summary?: string;
  targetEndDate?: string | null;
  targetStartDate?: string | null;
  title: string;
  type?: WorkItemType;
}

/**
 * @description Create a new work item using calm, lightweight defaults.
 */
export function createWorkItem(
  repository: WorkItemCreationRepository,
  input: CreateWorkItemInput,
): WorkItemRecord {
  const spaces = repository.listSpaces();
  const horizons = repository.listHorizons();
  const users = repository.listUsers();
  const workItems = repository.listWorkItems();
  const space = findSpace(spaces, input.spaceId);

  if (!space) {
    throw new ValidationError("Unknown space.");
  }

  const defaultHorizon =
    horizons.find(
      (horizon) => horizon.spaceId === input.spaceId && horizon.key === defaultHorizonKey,
    ) ?? null;
  const horizon = input.horizonId ? findHorizon(horizons, input.horizonId) : defaultHorizon;

  if (!horizon || horizon.spaceId !== space.id) {
    throw new ValidationError("Unknown horizon for the selected space.");
  }

  const ownerUserIds = normalizeOwnerUserIds(input.ownerUserIds);

  if (ownerUserIds.some((ownerUserId) => !users.some((user) => user.id === ownerUserId))) {
    throw new ValidationError("Unknown owner selected.");
  }

  const now = new Date().toISOString();
  const nextRef = getNextRef(workItems.map((item) => item.ref));
  const workItem = WorkItem.create({
    horizonId: horizon.id,
    id: generateId(),
    now,
    ownerName: resolveOwnerName(users, ownerUserIds, input.ownerName),
    ownerUserIds,
    ref: nextRef,
    source: input.source,
    spaceId: space.id,
    state: input.state,
    summary: input.summary,
    targetEndDate: input.targetEndDate,
    targetStartDate: input.targetStartDate,
    title: input.title,
    type: input.type,
  });
  const workItemDTO: WorkItemDTO = workItem.toDTO();

  const event: MikroLensDomainEvent = {
    action: "work-item.created",
    entityId: workItemDTO.id,
    entityType: "work-item",
    metadata: {
      ref: workItemDTO.ref,
      state: workItemDTO.state,
    },
    occurredAt: now,
    summary: `${workItemDTO.ref} was captured in ${space.name}.`,
  };

  repository.transaction(() => {
    repository.saveWorkItem(workItemDTO);
    emitMikroLensEvents(repository, [event]);
  });

  return findWorkItemRecord(repository.getLedger(), workItemDTO.id) as WorkItemRecord;
}

function getNextRef(existingRefs: string[]): string {
  const maxRef = existingRefs.reduce((highest, ref) => {
    const match = /ML-(\d+)/.exec(ref);

    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `ML-${maxRef + 1}`;
}

function normalizeOwnerUserIds(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function resolveOwnerName(
  users: ReturnType<WorkItemCreationRepository["listUsers"]>,
  ownerUserIds: string[],
  fallback?: string | null,
): string | null {
  if (ownerUserIds.length === 0) {
    const trimmed = String(fallback ?? "").trim();
    return trimmed || null;
  }

  const ownerNames = ownerUserIds
    .map((ownerUserId) => users.find((user) => user.id === ownerUserId) ?? null)
    .filter(isPresent)
    .map((user) => user.name?.trim() || user.email.trim());

  return ownerNames.join(", ") || null;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
