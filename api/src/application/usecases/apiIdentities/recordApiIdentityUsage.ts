import { ApiIdentity, type ApiIdentityDTO } from "../../../domain/ApiIdentity.ts";
import type { ApiIdentityRepository } from "../../ports/MikroLensRepository.ts";

export function recordApiIdentityUsage(
  repository: Pick<ApiIdentityRepository, "saveApiIdentity">,
  apiIdentity: ApiIdentityDTO,
  timestamp = new Date().toISOString(),
): ApiIdentityDTO {
  const updated = ApiIdentity.rehydrate(apiIdentity).recordUsage(timestamp).toDTO();

  repository.saveApiIdentity(updated);
  return updated;
}
