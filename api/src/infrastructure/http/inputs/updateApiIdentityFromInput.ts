import type { ManagedApiIdentityUpdateRepository } from "../../../application/ports/MikroLensRepository.ts";
import { updateApiIdentity } from "../../../application/usecases/apiIdentities/updateApiIdentity.ts";
import type { ApiIdentityDTO } from "../../../domain/ApiIdentity.ts";
import { isApiIdentityStatus } from "../../../domain/ApiIdentity.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import {
  buildBoardIds,
  parseAccessPolicyInput,
  validateAccessPolicyInput,
} from "./accessPolicyInput.ts";

export interface UpdateApiIdentityFromInput {
  description?: string;
  id: string;
  name?: string;
  permissions?: unknown;
  status?: string;
}

/**
 * @description Update an API identity from a loose command payload while preserving current access defaults.
 */
export function updateApiIdentityFromInput(
  repository: ManagedApiIdentityUpdateRepository,
  input: UpdateApiIdentityFromInput,
): ApiIdentityDTO {
  const existing = repository.getApiIdentity(input.id);

  if (!existing) {
    throw new NotFoundError("API identity not found.");
  }

  const boardIds = buildBoardIds(repository);
  const permissionsError = validateAccessPolicyInput(input.permissions, boardIds);

  if (permissionsError) {
    throw new ValidationError(permissionsError);
  }

  return updateApiIdentity(repository, {
    description: input.description,
    id: input.id,
    name: input.name,
    permissions: parseAccessPolicyInput(input.permissions, boardIds, existing.permissions),
    status: input.status && isApiIdentityStatus(input.status) ? input.status : undefined,
  });
}
