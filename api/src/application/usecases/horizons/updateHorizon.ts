import { Horizon, type HorizonDTO } from "../../../domain/Horizon.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { HorizonUpdateRepository } from "../../ports/MikroLensRepository.ts";

export interface UpdateHorizonInput {
  description?: string;
  id: string;
  label?: string;
  timeframeText?: string;
  useDefaults?: boolean;
}

/**
 * @description Update the presentation and timing metadata for a horizon.
 */
export function updateHorizon(
  repository: HorizonUpdateRepository,
  input: UpdateHorizonInput,
): HorizonDTO {
  const existing = repository.getHorizon(input.id);

  if (!existing) {
    throw new NotFoundError("Horizon not found.");
  }

  const defaults = repository.getHorizonDefault(existing.key);

  if (!defaults) {
    throw new NotFoundError("Horizon defaults not found.");
  }

  const updated = Horizon.rehydrate(existing)
    .updateDetails(
      {
        description: input.description,
        label: input.label,
        now: new Date().toISOString(),
        timeframeText: input.timeframeText,
        useDefaults: input.useDefaults,
      },
      defaults,
    )
    .toDTO();

  repository.saveHorizon(updated);
  return updated;
}
