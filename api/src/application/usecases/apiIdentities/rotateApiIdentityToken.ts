import type { ApiIdentityProvisioningResult } from "../../../domain/ApiIdentity.ts";
import { ApiIdentity } from "../../../domain/ApiIdentity.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { ApiIdentityRotationRepository } from "../../ports/MikroLensRepository.ts";
import { generateApiIdentityToken, hashApiIdentityToken } from "./apiIdentityTokens.ts";

/**
 * @description Rotate the bearer token for an API identity and return the new token once.
 */
export function rotateApiIdentityToken(
  repository: ApiIdentityRotationRepository,
  apiIdentityId: string,
): ApiIdentityProvisioningResult {
  const existing = repository.getApiIdentity(apiIdentityId);

  if (!existing) {
    throw new NotFoundError("API identity not found.");
  }

  const timestamp = new Date().toISOString();
  const apiIdentity = ApiIdentity.rehydrate(existing).recordTokenRotation(timestamp).toDTO();
  const token = generateApiIdentityToken();

  repository.saveApiIdentity(apiIdentity);
  repository.replaceApiIdentityToken(apiIdentity.id, hashApiIdentityToken(token), timestamp);

  return {
    apiIdentity,
    token,
  };
}
