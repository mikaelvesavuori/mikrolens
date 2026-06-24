import { Space, type SpaceDTO } from "../../../domain/Space.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import type { SpaceUpdateRepository } from "../../ports/MikroLensRepository.ts";

export interface UpdateSpaceInput {
  accent?: string;
  description?: string;
  id: string;
  name?: string;
}

/**
 * @description Update the core metadata for a space.
 */
export function updateSpace(repository: SpaceUpdateRepository, input: UpdateSpaceInput): SpaceDTO {
  const existing = repository.getSpace(input.id);

  if (!existing) {
    throw new NotFoundError("Space not found.");
  }

  const nextName = input.name?.trim() || existing.name;

  if (
    repository
      .listSpaces()
      .some(
        (space) => space.id !== existing.id && space.name.toLowerCase() === nextName.toLowerCase(),
      )
  ) {
    throw new ValidationError("A space with that name already exists.");
  }

  const updated = Space.rehydrate(existing)
    .updateDetails({
      accent: input.accent,
      description: input.description,
      name: input.name,
      now: new Date().toISOString(),
    })
    .toDTO();

  repository.saveSpace(updated);
  return updated;
}
