import { Signal, type SignalRecord, type SignalUrgency } from "../../../domain/Signal.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { SignalCreationRepository } from "../../ports/MikroLensRepository.ts";
import { buildSignalRecords } from "../../queries/LedgerReadModels.ts";

export interface CreateSignalInput {
  expectedTimeline?: string | null;
  summary?: string;
  source: string;
  title: string;
  urgency?: SignalUrgency | null;
}

/**
 * @description Create a shared signal in the global intake.
 */
export function createSignal(
  repository: SignalCreationRepository,
  input: CreateSignalInput,
): SignalRecord {
  const now = new Date().toISOString();
  const signal = Signal.create({
    expectedTimeline: input.expectedTimeline,
    id: generateId(),
    now,
    ref: getNextSignalRef(repository.listSignals().map((entry) => entry.ref)),
    source: input.source,
    summary: input.summary,
    title: input.title,
    urgency: input.urgency,
  }).toDTO();

  const event: MikroLensDomainEvent = {
    action: "signal.created",
    entityId: signal.id,
    entityType: "signal",
    metadata: {
      ref: signal.ref,
      status: signal.status,
      urgency: signal.urgency,
    },
    occurredAt: now,
    summary: `${signal.ref} came from ${signal.source}.`,
  };

  repository.transaction(() => {
    repository.saveSignal(signal);
    emitMikroLensEvents(repository, [event]);
  });

  return buildSignalRecords(repository.getLedger()).find(
    (entry) => entry.id === signal.id,
  ) as SignalRecord;
}

function getNextSignalRef(existingRefs: string[]): string {
  const maxRef = existingRefs.reduce((highest, ref) => {
    const match = /SIG-(\d+)/.exec(ref);

    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `SIG-${maxRef + 1}`;
}
