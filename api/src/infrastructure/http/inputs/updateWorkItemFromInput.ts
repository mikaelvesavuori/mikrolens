import type { WorkItemUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateWorkItem } from "../../../application/usecases/workItems/updateWorkItem.ts";
import type { WorkItemRecord } from "../../../domain/WorkItem.ts";
import { isWorkflowState, isWorkItemType } from "../../../domain/WorkItem.ts";

export interface UpdateWorkItemFromInput {
  blockedReason?: string;
  horizonId?: string;
  id: string;
  ownerName?: string | null;
  ownerUserIds?: string[];
  state?: string;
  summary?: string;
  targetEndDate?: string | null;
  targetStartDate?: string | null;
  title?: string;
  type?: string;
}

/**
 * @description Update a work item from a loose command payload.
 */
export function updateWorkItemFromInput(
  repository: WorkItemUpdateRepository,
  input: UpdateWorkItemFromInput,
): WorkItemRecord {
  return updateWorkItem(repository, {
    blockedReason: input.blockedReason,
    horizonId: input.horizonId,
    id: input.id,
    ownerName: input.ownerName,
    ownerUserIds: normalizeOwnerUserIds(input.ownerUserIds),
    state: input.state && isWorkflowState(input.state) ? input.state : undefined,
    summary: input.summary,
    targetEndDate: input.targetEndDate,
    targetStartDate: input.targetStartDate,
    title: input.title,
    type: input.type && isWorkItemType(input.type) ? input.type : undefined,
  });
}

function normalizeOwnerUserIds(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}
