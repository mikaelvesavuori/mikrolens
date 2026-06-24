import type { WebhookDelivery } from "../../../domain/Webhook.ts";
import { NotFoundError } from "../../../errors/MikroLensError.ts";
import type { WebhookDeliveriesRepository } from "../../ports/MikroLensRepository.ts";

export interface GetWebhookDeliveriesInput {
  endpointId: string;
  limit?: number;
}

/**
 * @description Load deliveries for a webhook endpoint after validating the target exists.
 */
export function getWebhookDeliveries(
  repository: WebhookDeliveriesRepository,
  input: GetWebhookDeliveriesInput,
): WebhookDelivery[] {
  const endpoint = repository.getWebhookEndpoint(input.endpointId);

  if (!endpoint) {
    throw new NotFoundError("Webhook endpoint not found.");
  }

  const parsedLimit = input.limit ?? 50;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

  return repository.listWebhookDeliveries(input.endpointId, limit);
}
