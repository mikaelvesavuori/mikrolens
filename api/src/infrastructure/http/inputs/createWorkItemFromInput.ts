import type { WorkItemCreationRepository } from "../../../application/ports/MikroLensRepository.ts";
import { createWorkItem } from "../../../application/usecases/workItems/createWorkItem.ts";
import type { WorkItemRecord } from "../../../domain/WorkItem.ts";
import { isWorkflowState, isWorkItemType } from "../../../domain/WorkItem.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface CreateWorkItemFromInput {
  horizonId?: string;
  ownerName?: string | null;
  ownerUserIds?: string[];
  source?: string | null;
  spaceId?: string;
  state?: string;
  summary?: string;
  targetEndDate?: string | null;
  targetStartDate?: string | null;
  title?: string;
  type?: string;
}

/**
 * @description Create a work item from a loose command payload while preserving HTTP-facing validation messages.
 */
export function createWorkItemFromInput(
  repository: WorkItemCreationRepository,
  input: CreateWorkItemFromInput,
): WorkItemRecord {
  const title = input.title?.trim() ?? "";
  const spaceId = input.spaceId?.trim() ?? "";

  if (!title || !spaceId) {
    throw new ValidationError("Both title and spaceId are required.");
  }

  return createWorkItem(repository, {
    horizonId: input.horizonId,
    ownerName: input.ownerName ?? null,
    ownerUserIds: normalizeOwnerUserIds(input.ownerUserIds),
    source: input.source === "planned" || input.source === "unplanned" ? input.source : undefined,
    spaceId,
    state: input.state && isWorkflowState(input.state) ? input.state : undefined,
    summary: input.summary,
    targetEndDate: input.targetEndDate,
    targetStartDate: input.targetStartDate,
    title,
    type: input.type && isWorkItemType(input.type) ? input.type : undefined,
  });
}

function normalizeOwnerUserIds(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}
