import { createServer } from "node:http";
import { createWorkItem } from "../../../src/application/usecases/workItems/createWorkItem.ts";
import type { WebhookEndpoint } from "../../../src/domain/Webhook.ts";
import { generateId } from "../../../src/infrastructure/utils/id.ts";
import { WebhookDeliveryWorker } from "../../../src/infrastructure/webhooks/WebhookDeliveryWorker.ts";
import { createTestRepository } from "../../support/testUtils.ts";

describe("WebhookDeliveryWorker", () => {
  it("delivers queued webhook payloads from the outbox", async () => {
    const { database, repository } = createTestRepository();
    let receivedBody = "";
    let receivedHeaders: Record<string, string | string[] | undefined> = {};

    const receiver = createServer((request, response) => {
      receivedHeaders = request.headers;
      let body = "";

      request.on("data", (chunk) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        receivedBody = body;
        response.statusCode = 204;
        response.end();
      });
    });

    await new Promise<void>((resolve) => {
      receiver.listen(0, "127.0.0.1", () => resolve());
    });

    const address = receiver.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test receiver address.");
    }

    const endpoint = createWebhookEndpoint(`http://127.0.0.1:${address.port}/webhooks/work-items`, [
      "work-item.created",
    ]);
    repository.saveWebhookEndpoint(endpoint);

    const workItem = createWorkItem(repository, {
      spaceId: "space_platform",
      title: "Ship outbound webhook worker",
      type: "Task",
    });

    const worker = new WebhookDeliveryWorker(repository, {
      batchSize: 5,
      concurrency: 2,
      pollIntervalMs: 10,
    });

    try {
      expect(await worker.pollOnce()).toBe(1);

      const [delivery] = repository.listWebhookDeliveries(endpoint.id, 10);

      expect(delivery?.status).toBe("delivered");
      expect(delivery?.deliveredAt).toEqual(expect.any(String));
      expect(receivedHeaders["x-mikrolens-event"]).toBe("work-item.created");
      expect(receivedHeaders["x-mikrolens-delivery"]).toBe(delivery?.id);
      expect(String(receivedHeaders["x-mikrolens-signature"])).toContain("sha256=");

      const payload = JSON.parse(receivedBody);
      expect(payload.type).toBe("work-item.created");
      expect(payload.entityId).toBe(workItem.id);
      expect(payload.data.workItem.id).toBe(workItem.id);
    } finally {
      receiver.close();
      database.close();
    }
  });

  it("reschedules recoverable delivery failures", async () => {
    const { database, repository } = createTestRepository();
    const endpoint = createWebhookEndpoint("https://example.com/webhooks/retry", [
      "work-item.created",
    ]);
    repository.saveWebhookEndpoint(endpoint);

    createWorkItem(repository, {
      spaceId: "space_platform",
      title: "Retry webhook deliveries on transient failures",
      type: "Task",
    });

    const worker = new WebhookDeliveryWorker(repository, {
      deliver: async () => ({
        statusCode: 500,
      }),
      maxAttempts: 6,
    });

    try {
      expect(await worker.pollOnce()).toBe(1);

      const [delivery] = repository.listWebhookDeliveries(endpoint.id, 10);

      expect(delivery?.status).toBe("pending");
      expect(delivery?.attemptCount).toBe(1);
      expect(delivery?.lastError).toContain("status 500");
      expect(new Date(delivery?.nextAttemptAt ?? 0).getTime()).toBeGreaterThan(
        new Date(delivery?.createdAt ?? 0).getTime(),
      );
    } finally {
      database.close();
    }
  });
});

function createWebhookEndpoint(url: string, subscribedEvents: string[]): WebhookEndpoint {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    id: generateId(),
    name: "Test webhook",
    secret: "test-secret",
    spaceId: null,
    status: "Active",
    subscribedEvents,
    updatedAt: now,
    url,
  };
}
