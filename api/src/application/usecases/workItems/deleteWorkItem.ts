import { Signal } from "../../../domain/Signal.ts";
import type { WorkItemRecord } from "../../../domain/WorkItem.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { WorkItemDeletionRepository } from "../../ports/MikroLensRepository.ts";
import { findWorkItemRecord } from "../../queries/LedgerReadModels.ts";

/**
 * @description Delete a work item, reopen any linked signals, and remove its links/activity.
 */
export function deleteWorkItem(
  repository: WorkItemDeletionRepository,
  workItemId: string,
): WorkItemRecord {
  const deleted = findWorkItemRecord(repository.getLedger(), workItemId);

  if (!deleted) {
    throw new NotFoundError("Work item not found.");
  }

  repository.transaction(() => {
    const linkedSignals = repository
      .listSignals()
      .filter((signal) => signal.pulledIntoWorkItemId === workItemId);

    for (const signal of linkedSignals) {
      repository.saveSignal(Signal.rehydrate(signal).reopen(new Date().toISOString()).toDTO());
    }

    repository.deleteDocumentLinksForWorkItem(workItemId);
    repository.deleteActivityForEntity("work-item", workItemId);
    repository.deleteWorkItem(workItemId);
  });

  return deleted;
}
