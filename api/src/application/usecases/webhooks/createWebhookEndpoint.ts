import {
  isValidWebhookUrl,
  isWebhookEndpointStatus,
  type WebhookEndpoint,
} from "../../../domain/Webhook.ts";
import { ValidationError } from "../../../errors/MikroLensError.ts";
import { generateId } from "../../../infrastructure/utils/id.ts";
import type { WebhookCreationRepository } from "../../ports/MikroLensRepository.ts";

export interface CreateWebhookEndpointInput {
  name: string;
  secret: string;
  spaceId?: string | null;
  status?: string | null;
  subscribedEvents: string[];
  url: string;
}

/**
 * @description Create a new outbound webhook endpoint with lightweight validation.
 */
export function createWebhookEndpoint(
  repository: WebhookCreationRepository,
  input: CreateWebhookEndpointInput,
): WebhookEndpoint {
  const name = input.name.trim();
  const secret = input.secret.trim();
  const url = input.url.trim();
  const spaceId = input.spaceId?.trim() || null;
  const status: WebhookEndpoint["status"] =
    input.status && isWebhookEndpointStatus(input.status) ? input.status : "Active";

  if (!name || !url || !secret) {
    throw new ValidationError("Name, url, and secret are required.");
  }

  if (!isValidWebhookUrl(url)) {
    throw new ValidationError("Webhook url must be a valid http or https URL.");
  }

  if (input.subscribedEvents.length === 0) {
    throw new ValidationError("At least one subscribed event is required.");
  }

  if (spaceId && !repository.getSpace(spaceId)) {
    throw new ValidationError("Webhook space must reference an existing space.");
  }

  const now = new Date().toISOString();

  const endpoint: WebhookEndpoint = {
    createdAt: now,
    id: generateId(),
    name,
    secret,
    spaceId,
    status,
    subscribedEvents: input.subscribedEvents,
    updatedAt: now,
    url,
  };

  repository.saveWebhookEndpoint(endpoint);
  return endpoint;
}
