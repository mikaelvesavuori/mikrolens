import type { SignalCreationRepository } from "../../../application/ports/MikroLensRepository.ts";
import { createSignal } from "../../../application/usecases/signals/createSignal.ts";
import type { SignalRecord } from "../../../domain/Signal.ts";
import { isSignalUrgency } from "../../../domain/Signal.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface CreateSignalFromInput {
  expectedTimeline?: string;
  summary?: string;
  source?: string;
  title?: string;
  urgency?: string;
}

/**
 * @description Create a signal from a loose command payload while preserving HTTP-facing validation messages.
 */
export function createSignalFromInput(
  repository: SignalCreationRepository,
  input: CreateSignalFromInput,
): SignalRecord {
  const title = input.title?.trim() ?? "";
  const source = input.source?.trim() ?? "";

  if (!title || !source) {
    throw new ValidationError("Both title and source are required.");
  }

  return createSignal(repository, {
    expectedTimeline: input.expectedTimeline,
    summary: input.summary,
    source,
    title,
    urgency: input.urgency && isSignalUrgency(input.urgency) ? input.urgency : undefined,
  });
}
