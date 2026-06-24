import { HorizonDefault, type HorizonDefaultDTO } from "../../../domain/Horizon.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { HorizonDefaultUpdateRepository } from "../../ports/MikroLensRepository.ts";

export interface UpdateHorizonDefaultInput {
  description?: string;
  key: string;
  label?: string;
  timeframeText?: string;
}

/**
 * @description Update the organization-wide default settings for one fixed Horizon slot.
 */
export function updateHorizonDefault(
  repository: HorizonDefaultUpdateRepository,
  input: UpdateHorizonDefaultInput,
): HorizonDefaultDTO {
  const existing = repository.getHorizonDefault(input.key);

  if (!existing) {
    throw new NotFoundError("Horizon defaults not found.");
  }

  const updated = HorizonDefault.rehydrate(existing)
    .updateDetails({
      description: input.description,
      label: input.label,
      now: new Date().toISOString(),
      timeframeText: input.timeframeText,
    })
    .toDTO();

  repository.saveHorizonDefault(updated);
  return updated;
}
