import type { SignalUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateSignal } from "../../../application/usecases/signals/updateSignal.ts";
import type { SignalRecord } from "../../../domain/Signal.ts";
import { isSignalUrgency } from "../../../domain/Signal.ts";

export interface UpdateSignalFromInput {
  expectedTimeline?: string | null;
  id: string;
  source?: string;
  summary?: string;
  title?: string;
  urgency?: string;
}

/**
 * @description Update a signal from a loose command payload.
 */
export function updateSignalFromInput(
  repository: SignalUpdateRepository,
  input: UpdateSignalFromInput,
): SignalRecord {
  return updateSignal(repository, {
    expectedTimeline: input.expectedTimeline,
    id: input.id,
    source: input.source,
    summary: input.summary,
    title: input.title,
    urgency: input.urgency && isSignalUrgency(input.urgency) ? input.urgency : undefined,
  });
}
