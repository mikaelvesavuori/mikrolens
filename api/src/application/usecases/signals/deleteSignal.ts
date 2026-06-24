import type { SignalRecord } from "../../../domain/Signal.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { SignalDeletionRepository } from "../../ports/MikroLensRepository.ts";
import { findSignalRecord } from "../../queries/LedgerReadModels.ts";

/**
 * @description Delete a signal and its activity trail.
 */
export function deleteSignal(repository: SignalDeletionRepository, signalId: string): SignalRecord {
  const deleted = findSignalRecord(repository.getLedger(), signalId);

  if (!deleted) {
    throw new NotFoundError("Signal not found.");
  }

  repository.transaction(() => {
    repository.deleteActivityForEntity("signal", signalId);
    repository.deleteSignal(signalId);
  });

  return deleted;
}
