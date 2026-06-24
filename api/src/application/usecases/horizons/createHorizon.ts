import { Horizon, type HorizonDTO, isHorizonKey } from "../../../domain/Horizon.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import type { HorizonCreationRepository } from "../../ports/MikroLensRepository.ts";
import { findSpace } from "../../queries/LedgerLookups.ts";

export interface CreateHorizonInput {
  key: string;
  spaceId: string;
}

/**
 * @description Create a missing fixed Horizon slot for a space when one is absent.
 */
export function createHorizon(
  repository: HorizonCreationRepository,
  input: CreateHorizonInput,
): HorizonDTO {
  const space = findSpace(repository.listSpaces(), input.spaceId);

  if (!space) {
    throw new ValidationError("Unknown space.");
  }

  if (!isHorizonKey(input.key)) {
    throw new ValidationError("Unknown horizon key.");
  }

  if (
    repository
      .listHorizons()
      .some((horizon) => horizon.spaceId === input.spaceId && horizon.key === input.key)
  ) {
    throw new ValidationError("That horizon already exists for the space.");
  }

  const defaults = repository.getHorizonDefault(input.key);

  if (!defaults) {
    throw new ValidationError("Unknown horizon defaults.");
  }

  const horizon = Horizon.create(
    {
      id: generateId(),
      key: input.key,
      now: new Date().toISOString(),
      spaceId: input.spaceId,
    },
    defaults,
  ).toDTO();

  repository.saveHorizon(horizon);
  return horizon;
}
