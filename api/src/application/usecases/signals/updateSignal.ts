import { Signal, type SignalRecord, type SignalUrgency } from "../../../domain/Signal.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { SignalUpdateRepository } from "../../ports/MikroLensRepository.ts";
import { buildSignalRecords } from "../../queries/LedgerReadModels.ts";

export interface UpdateSignalInput {
  expectedTimeline?: string | null;
  id: string;
  source?: string;
  summary?: string;
  title?: string;
  urgency?: SignalUrgency;
}

/**
 * @description Update a signal without turning it into operational work.
 */
export function updateSignal(
  repository: SignalUpdateRepository,
  input: UpdateSignalInput,
): SignalRecord {
  const existing = repository.getSignal(input.id);

  if (!existing) {
    throw new NotFoundError("Signal not found.");
  }

  const now = new Date().toISOString();
  const updated = Signal.rehydrate(existing)
    .updateDetails({
      expectedTimeline: input.expectedTimeline,
      now,
      source: input.source,
      summary: input.summary,
      title: input.title,
      urgency: input.urgency,
    })
    .toDTO();

  const event: MikroLensDomainEvent = {
    action: "signal.updated",
    entityId: updated.id,
    entityType: "signal",
    metadata: {
      ref: updated.ref,
      status: updated.status,
      urgency: updated.urgency,
    },
    occurredAt: now,
    summary: `${updated.ref} was updated.`,
  };

  repository.transaction(() => {
    repository.saveSignal(updated);
    emitMikroLensEvents(repository, [event]);
  });

  return buildSignalRecords(repository.getLedger()).find(
    (entry) => entry.id === updated.id,
  ) as SignalRecord;
}
