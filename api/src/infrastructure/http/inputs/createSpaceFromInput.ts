import type { SpaceCreationRepository } from "../../../application/ports/MikroLensRepository.ts";
import { createSpace } from "../../../application/usecases/spaces/createSpace.ts";
import type { SpaceDTO } from "../../../domain/Space.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";

export interface CreateSpaceFromInput {
  accent?: string;
  description?: string;
  name?: string;
}

/**
 * @description Create a space from a loose command payload while preserving HTTP-facing validation messages.
 */
export function createSpaceFromInput(
  repository: SpaceCreationRepository,
  input: CreateSpaceFromInput,
): SpaceDTO {
  const name = input.name?.trim() ?? "";

  if (!name) {
    throw new ValidationError("Space name is required.");
  }

  return createSpace(repository, {
    accent: input.accent,
    description: input.description,
    name,
  });
}
