import type { ActivityEntityType, ActivityEvent } from "../../domain/Activity.ts";
import { generateId } from "../../infrastructure/utils/id.ts";
import type { DomainEventRepository } from "../ports/MikroLensRepository.ts";

export interface MikroLensDomainEvent {
  action: string;
  entityId: string;
  entityType: ActivityEntityType;
  id?: string;
  metadata: ActivityEvent["metadata"];
  occurredAt?: string;
  summary: string;
}

/**
 * @description Persist emitted domain events as activity entries and webhook deliveries.
 */
export function emitMikroLensEvents(
  repository: DomainEventRepository,
  events: MikroLensDomainEvent[],
): void {
  for (const event of events) {
    const activity: ActivityEvent = {
      action: event.action,
      createdAt: event.occurredAt ?? new Date().toISOString(),
      entityId: event.entityId,
      entityType: event.entityType,
      id: event.id ?? generateId(),
      metadata: event.metadata,
      summary: event.summary,
    };

    repository.saveActivity(activity);
    repository.enqueueWebhookDeliveries(activity);
  }
}
