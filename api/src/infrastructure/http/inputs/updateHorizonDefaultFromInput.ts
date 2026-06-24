import type { HorizonDefaultUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateHorizonDefault } from "../../../application/usecases/horizons/updateHorizonDefault.ts";
import type { HorizonDefaultDTO } from "../../../domain/Horizon.ts";

export interface UpdateHorizonDefaultFromInput {
  description?: string;
  key: string;
  label?: string;
  timeframeText?: string;
}

/**
 * @description Update organization-wide Horizon defaults from a loose command payload.
 */
export function updateHorizonDefaultFromInput(
  repository: HorizonDefaultUpdateRepository,
  input: UpdateHorizonDefaultFromInput,
): HorizonDefaultDTO {
  return updateHorizonDefault(repository, input);
}
