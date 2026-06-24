import { getBuiltInHorizonDefaults, Horizon } from "../../../domain/Horizon.ts";
import { Space, type SpaceDTO } from "../../../domain/Space.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import type { SpaceCreationRepository } from "../../ports/MikroLensRepository.ts";

export interface CreateSpaceInput {
  accent?: string;
  description?: string;
  name: string;
}

/**
 * @description Create a new space and seed the standard planning horizons.
 */
export function createSpace(
  repository: SpaceCreationRepository,
  input: CreateSpaceInput,
): SpaceDTO {
  const name = input.name.trim();

  if (repository.listSpaces().some((space) => space.name.toLowerCase() === name.toLowerCase())) {
    throw new ValidationError("A space with that name already exists.");
  }

  const now = new Date().toISOString();
  const space = Space.create({
    accent: input.accent,
    description: input.description,
    id: generateId(),
    name,
    now,
  }).toDTO();

  repository.saveSpace(space);

  const horizonDefaults = repository.listHorizonDefaults();
  const defaultsToUse =
    horizonDefaults.length > 0 ? horizonDefaults : getBuiltInHorizonDefaults(now);

  for (const horizonDefault of defaultsToUse) {
    repository.saveHorizon(
      Horizon.create(
        {
          id: generateId(),
          key: horizonDefault.key,
          now,
          spaceId: space.id,
        },
        horizonDefault,
      ).toDTO(),
    );
  }

  return space;
}
