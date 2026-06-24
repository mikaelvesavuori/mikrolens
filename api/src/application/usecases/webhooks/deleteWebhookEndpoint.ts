import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { WebhookDeletionRepository } from "../../ports/MikroLensRepository.ts";

/**
 * @description Delete a webhook endpoint after confirming it exists.
 */
export function deleteWebhookEndpoint(
  repository: WebhookDeletionRepository,
  endpointId: string,
): void {
  const endpoint = repository.getWebhookEndpoint(endpointId);

  if (!endpoint) {
    throw new NotFoundError("Webhook endpoint not found.");
  }

  repository.deleteWebhookEndpoint(endpointId);
}
