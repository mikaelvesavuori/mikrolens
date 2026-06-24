import type { WorkItemRecord } from "../../../domain/WorkItem.ts";
import { WorkItem } from "../../../domain/WorkItem.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { WorkItemUpdateRepository } from "../../ports/MikroLensRepository.ts";
import { findHorizon } from "../../queries/LedgerLookups.ts";
import { findWorkItemRecord } from "../../queries/LedgerReadModels.ts";

export interface UpdateWorkItemInput {
  blockedReason?: string;
  horizonId?: string;
  id: string;
  ownerName?: string | null;
  ownerUserIds?: string[];
  state?: WorkItemRecord["state"];
  summary?: string;
  targetEndDate?: string | null;
  targetStartDate?: string | null;
  title?: string;
  type?: WorkItemRecord["type"];
}

/**
 * @description Apply a small operational update to an existing work item.
 */
export function updateWorkItem(
  repository: WorkItemUpdateRepository,
  input: UpdateWorkItemInput,
): WorkItemRecord {
  const existing = repository.getWorkItem(input.id);

  if (!existing) {
    throw new NotFoundError("Work item not found.");
  }

  const horizon = input.horizonId ? findHorizon(repository.listHorizons(), input.horizonId) : null;
  const users = repository.listUsers();

  if (input.horizonId && (!horizon || horizon.spaceId !== existing.spaceId)) {
    throw new ValidationError("Horizon does not belong to the work item's space.");
  }

  const ownerUserIds =
    input.ownerUserIds === undefined ? undefined : normalizeOwnerUserIds(input.ownerUserIds);

  if ((ownerUserIds ?? []).some((ownerUserId) => !users.some((user) => user.id === ownerUserId))) {
    throw new ValidationError("Unknown owner selected.");
  }

  const now = new Date().toISOString();
  const updated = WorkItem.rehydrate(existing).applyOperationalUpdate({
    blockedReason: input.blockedReason,
    horizonId: horizon?.id,
    now,
    ownerName: resolveOwnerName(users, ownerUserIds, input.ownerName),
    ownerUserIds,
    state: input.state,
    summary: input.summary,
    targetEndDate: input.targetEndDate,
    targetStartDate: input.targetStartDate,
    title: input.title,
    type: input.type,
  });
  const updatedDTO = updated.toDTO();

  const event: MikroLensDomainEvent = {
    action: input.state && input.state !== existing.state ? "state.changed" : "work-item.updated",
    entityId: updatedDTO.id,
    entityType: "work-item",
    metadata: {
      nextState: updatedDTO.state,
      previousState: existing.state,
      ref: updatedDTO.ref,
    },
    occurredAt: now,
    summary:
      input.state && input.state !== existing.state
        ? `${updatedDTO.ref} moved from ${existing.state} to ${updatedDTO.state}.`
        : `${updatedDTO.ref} was updated.`,
  };

  repository.transaction(() => {
    repository.saveWorkItem(updatedDTO);
    emitMikroLensEvents(repository, [event]);
  });

  return findWorkItemRecord(repository.getLedger(), updatedDTO.id) as WorkItemRecord;
}

function normalizeOwnerUserIds(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function resolveOwnerName(
  users: ReturnType<WorkItemUpdateRepository["listUsers"]>,
  ownerUserIds: string[] | undefined,
  fallback?: string | null,
): string | null | undefined {
  if (ownerUserIds === undefined) {
    return fallback;
  }

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
