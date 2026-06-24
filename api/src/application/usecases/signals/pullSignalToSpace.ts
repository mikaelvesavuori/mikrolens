import { Signal } from "../../../domain/Signal.ts";
import type { WorkItemRecord } from "../../../domain/WorkItem.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import {
  emitMikroLensEvents,
  type MikroLensDomainEvent,
} from "../../events/emitMikroLensEvents.ts";
import type { SignalPullRepository } from "../../ports/MikroLensRepository.ts";
import { findSpace } from "../../queries/LedgerLookups.ts";
import { createWorkItem } from "../workItems/createWorkItem.ts";

export interface PullSignalToSpaceInput {
  signalId: string;
  targetSpaceId: string;
}

/**
 * @description Pull a shared signal into a space Inbox and archive the intake copy.
 */
export function pullSignalToSpace(
  repository: SignalPullRepository,
  input: PullSignalToSpaceInput,
): WorkItemRecord {
  const signal = repository.getSignal(input.signalId);

  if (!signal) {
    throw new NotFoundError("Signal not found.");
  }

  const targetSpace = findSpace(repository.listSpaces(), input.targetSpaceId);

  if (!targetSpace) {
    throw new ValidationError("Choose a destination space.");
  }

  if (signal.status === "Pulled") {
    throw new ValidationError("Signal has already been pulled.");
  }

  const pulled = createWorkItem(repository, {
    source: "unplanned",
    spaceId: targetSpace.id,
    summary: signal.summary,
    title: signal.title,
    type: "Idea",
  });

  const now = new Date().toISOString();
  const updatedSignal = Signal.rehydrate(signal).markPulled(now, pulled.id).toDTO();

  const event: MikroLensDomainEvent = {
    action: "signal.pulled",
    entityId: signal.id,
    entityType: "signal",
    metadata: {
      pulledWorkItemRef: pulled.ref,
      ref: signal.ref,
      targetSpaceId: targetSpace.id,
    },
    occurredAt: now,
    summary: `${signal.ref} was pulled into ${targetSpace.name} as ${pulled.ref}.`,
  };

  repository.transaction(() => {
    repository.saveSignal(updatedSignal);
    emitMikroLensEvents(repository, [event]);
  });

  return pulled;
}
