import type { WebhookEndpoint } from "../../../domain/Webhook.ts";
import type { WebhookListRepository } from "../../ports/MikroLensRepository.ts";

/**
 * @description Return the configured outbound webhook endpoints.
 */
export function listWebhookEndpoints(repository: WebhookListRepository): WebhookEndpoint[] {
  return repository.listWebhookEndpoints();
}
