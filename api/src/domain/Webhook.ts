import type { ActivityEvent } from "./Activity.ts";
import type { DocumentDTO } from "./Document.ts";
import type { SignalDTO } from "./Signal.ts";
import type { WorkItemDTO } from "./WorkItem.ts";

export type WebhookEndpointStatus = "Active" | "Paused";
export type WebhookDeliveryStatus = "pending" | "processing" | "delivered" | "failed";

export const webhookEndpointStatuses = ["Active", "Paused"] as const;
export const webhookDeliveryStatuses = ["pending", "processing", "delivered", "failed"] as const;
export const webhookEventTypes = [
  "work-item.*",
  "work-item.created",
  "work-item.updated",
  "state.changed",
  "signal.*",
  "signal.created",
  "signal.updated",
  "signal.pulled",
  "document.*",
  "document.created",
  "document.updated",
] as const;

/**
 * @description A subscribed outbound webhook target for MikroLens activity.
 */
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  status: WebhookEndpointStatus;
  spaceId: string | null;
  subscribedEvents: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * @description Stable event envelope sent to outbound webhook endpoints.
 */
export interface WebhookEventEnvelope {
  id: string;
  type: string;
  occurredAt: string;
  entityType: ActivityEvent["entityType"];
  entityId: string;
  spaceId: string | null;
  data: {
    activity: ActivityEvent["metadata"];
    document?: DocumentDTO | null;
    signal?: SignalDTO | null;
    workItem?: WorkItemDTO | null;
  };
}

/**
 * @description A persisted outbound delivery attempt tracked in the webhook outbox.
 */
export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  payload: WebhookEventEnvelope;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string;
  claimedAt: string | null;
  claimedBy: string | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

/**
 * @description Narrow a free-form string to a valid webhook endpoint status.
 */
export function isWebhookEndpointStatus(value: string): value is WebhookEndpointStatus {
  return webhookEndpointStatuses.includes(value as WebhookEndpointStatus);
}

/**
 * @description Validate that a webhook target uses http or https.
 */
export function isValidWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
