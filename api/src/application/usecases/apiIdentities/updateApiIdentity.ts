import type { AccessPolicy } from "../../../domain/AccessPolicy.ts";
import type { ApiIdentityDTO, ApiIdentityStatus } from "../../../domain/ApiIdentity.ts";
import { ApiIdentity } from "../../../domain/ApiIdentity.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { ApiIdentityUpdateRepository } from "../../ports/MikroLensRepository.ts";

export interface UpdateApiIdentityInput {
  description?: string;
  id: string;
  name?: string;
  permissions?: AccessPolicy;
  status?: ApiIdentityStatus;
}

/**
 * @description Update the descriptive and lifecycle metadata for an API identity.
 */
export function updateApiIdentity(
  repository: ApiIdentityUpdateRepository,
  input: UpdateApiIdentityInput,
): ApiIdentityDTO {
  const existing = repository.getApiIdentity(input.id);

  if (!existing) {
    throw new NotFoundError("API identity not found.");
  }
  const updated = ApiIdentity.rehydrate(existing)
    .updateDetails({
      description: input.description,
      name: input.name,
      now: new Date().toISOString(),
      permissions: input.permissions,
      status: input.status,
    })
    .toDTO();

  repository.saveApiIdentity(updated);
  return updated;
}
