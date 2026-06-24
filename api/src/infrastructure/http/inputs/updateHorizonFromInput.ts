import type { HorizonUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateHorizon } from "../../../application/usecases/horizons/updateHorizon.ts";
import type { HorizonDTO } from "../../../domain/Horizon.ts";

export interface UpdateHorizonFromInput {
  description?: string;
  id: string;
  label?: string;
  timeframeText?: string;
  useDefaults?: boolean;
}

/**
 * @description Update a horizon from a loose command payload.
 */
export function updateHorizonFromInput(
  repository: HorizonUpdateRepository,
  input: UpdateHorizonFromInput,
): HorizonDTO {
  return updateHorizon(repository, input);
}
