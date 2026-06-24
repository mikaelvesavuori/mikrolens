import type { SignalPullRepository } from "../../../application/ports/MikroLensRepository.ts";
import { pullSignalToSpace } from "../../../application/usecases/signals/pullSignalToSpace.ts";
import type { WorkItemRecord } from "../../../domain/WorkItem.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface PullSignalToSpaceFromInput {
  signalId: string;
  targetSpaceId?: string;
}

/**
 * @description Pull a signal from a loose command payload while preserving HTTP-facing validation messages.
 */
export function pullSignalToSpaceFromInput(
  repository: SignalPullRepository,
  input: PullSignalToSpaceFromInput,
): WorkItemRecord {
  const targetSpaceId = input.targetSpaceId?.trim() ?? "";

  if (!targetSpaceId) {
    throw new ValidationError("targetSpaceId is required.");
  }

  return pullSignalToSpace(repository, {
    signalId: input.signalId,
    targetSpaceId,
  });
}
