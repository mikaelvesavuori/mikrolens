import type { HorizonCreationRepository } from "../../../application/ports/MikroLensRepository.ts";
import { createHorizon } from "../../../application/usecases/horizons/createHorizon.ts";
import type { HorizonDTO } from "../../../domain/Horizon.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface CreateHorizonFromInput {
  key?: string;
  spaceId?: string;
}

/**
 * @description Create a horizon from a loose command payload while preserving HTTP-facing validation messages.
 */
export function createHorizonFromInput(
  repository: HorizonCreationRepository,
  input: CreateHorizonFromInput,
): HorizonDTO {
  const key = input.key?.trim() ?? "";
  const spaceId = input.spaceId?.trim() ?? "";

  if (!spaceId || !key) {
    throw new ValidationError("Both spaceId and key are required.");
  }

  return createHorizon(repository, {
    key,
    spaceId,
  });
}
