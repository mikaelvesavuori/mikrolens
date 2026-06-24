import type { SpaceUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateSpace } from "../../../application/usecases/spaces/updateSpace.ts";
import type { SpaceDTO } from "../../../domain/Space.ts";

export interface UpdateSpaceFromInput {
  accent?: string;
  description?: string;
  id: string;
  name?: string;
}

/**
 * @description Update a space from a loose command payload.
 */
export function updateSpaceFromInput(
  repository: SpaceUpdateRepository,
  input: UpdateSpaceFromInput,
): SpaceDTO {
  return updateSpace(repository, input);
}
