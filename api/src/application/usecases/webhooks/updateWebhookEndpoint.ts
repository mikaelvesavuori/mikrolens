import {
  isValidWebhookUrl,
  isWebhookEndpointStatus,
  type WebhookEndpoint,
} from "../../../domain/Webhook.ts";
import { NotFoundError, ValidationError } from "../../../errors/MikroLensError.ts";
import type { WebhookUpdateRepository } from "../../ports/MikroLensRepository.ts";

export interface UpdateWebhookEndpointInput {
  id: string;
  name?: string;
  secret?: string;
  spaceId?: string | null;
  status?: string | null;
  subscribedEvents?: string[];
  url?: string;
}

/**
 * @description Update an existing webhook endpoint without exposing repository details to HTTP.
 */
export function updateWebhookEndpoint(
  repository: WebhookUpdateRepository,
  input: UpdateWebhookEndpointInput,
): WebhookEndpoint {
  const existing = repository.getWebhookEndpoint(input.id);

  if (!existing) {
    throw new NotFoundError("Webhook endpoint not found.");
  }

  if (input.status && !isWebhookEndpointStatus(input.status)) {
    throw new ValidationError("Webhook status must be Active or Paused.");
  }

  const url = input.url === undefined ? existing.url : input.url.trim();

  if (!url || !isValidWebhookUrl(url)) {
    throw new ValidationError("Webhook url must be a valid http or https URL.");
  }

  const subscribedEvents = input.subscribedEvents ?? existing.subscribedEvents;

  if (subscribedEvents.length === 0) {
    throw new ValidationError("At least one subscribed event is required.");
  }

  const spaceId = input.spaceId === undefined ? existing.spaceId : input.spaceId?.trim() || null;

  if (spaceId && !repository.getSpace(spaceId)) {
    throw new ValidationError("Webhook space must reference an existing space.");
  }

  const updated: WebhookEndpoint = {
    ...existing,
    name: input.name?.trim() || existing.name,
    secret: input.secret?.trim() || existing.secret,
    spaceId,
    status: input.status && isWebhookEndpointStatus(input.status) ? input.status : existing.status,
    subscribedEvents,
    updatedAt: new Date().toISOString(),
    url,
  };

  repository.saveWebhookEndpoint(updated);
  return updated;
}
