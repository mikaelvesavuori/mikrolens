import { createHmac } from "node:crypto";
import type { WebhookWorkerRepository } from "../../application/ports/MikroLensRepository.ts";
import type { WebhookDelivery, WebhookEndpoint } from "../../domain/Webhook.ts";
import { generateId } from "../utils/id.ts";

export interface WebhookDeliveryWorkerOptions {
  batchSize?: number;
  concurrency?: number;
  deliver?: (request: WebhookRequest) => Promise<WebhookDeliveryResult>;
  maxAttempts?: number;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
  staleClaimTimeoutMs?: number;
  workerId?: string;
}

export interface WebhookRequest {
  delivery: WebhookDelivery;
  endpoint: WebhookEndpoint;
  payload: string;
  requestTimeoutMs: number;
}

export interface WebhookDeliveryResult {
  statusCode: number;
}

/**
 * @description Separate delivery loop for draining MikroLens's webhook outbox.
 */
export class WebhookDeliveryWorker {
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly deliver: (request: WebhookRequest) => Promise<WebhookDeliveryResult>;
  private readonly maxAttempts: number;
  private readonly pollIntervalMs: number;
  private readonly repository: WebhookWorkerRepository;
  private readonly requestTimeoutMs: number;
  private readonly staleClaimTimeoutMs: number;
  private readonly workerId: string;
  private stopped = false;

  constructor(repository: WebhookWorkerRepository, options: WebhookDeliveryWorkerOptions = {}) {
    this.repository = repository;
    this.batchSize = options.batchSize ?? 10;
    this.concurrency = options.concurrency ?? 5;
    this.deliver = options.deliver ?? deliverWebhookRequest;
    this.maxAttempts = options.maxAttempts ?? 6;
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
    this.staleClaimTimeoutMs = options.staleClaimTimeoutMs ?? 60_000;
    this.workerId = options.workerId ?? generateId();
  }

  /**
   * @description Stop the polling loop after the current batch completes.
   */
  stop(): void {
    this.stopped = true;
  }

  /**
   * @description Run the polling loop until the worker is stopped.
   */
  async run(): Promise<void> {
    while (!this.stopped) {
      const processedCount = await this.pollOnce();

      if (processedCount === 0) {
        await sleep(this.pollIntervalMs);
      }
    }
  }

  /**
   * @description Claim and process one batch of due webhook deliveries.
   */
  async pollOnce(now = new Date()): Promise<number> {
    const claimedAt = now.toISOString();
    const staleBefore = new Date(now.getTime() - this.staleClaimTimeoutMs).toISOString();

    this.repository.releaseStaleWebhookClaims(staleBefore);

    const deliveries = this.repository.claimPendingWebhookDeliveries(
      this.workerId,
      claimedAt,
      this.batchSize,
    );

    for (let index = 0; index < deliveries.length; index += this.concurrency) {
      const batch = deliveries.slice(index, index + this.concurrency);
      await Promise.all(batch.map((delivery) => this.processDelivery(delivery)));
    }

    return deliveries.length;
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const endpoint = this.repository.getWebhookEndpoint(delivery.endpointId);

    if (!endpoint) {
      this.repository.failWebhookDelivery(
        delivery.id,
        "Webhook endpoint no longer exists.",
        delivery.attemptCount + 1,
      );
      return;
    }

    if (endpoint.status !== "Active") {
      this.repository.rescheduleWebhookDelivery(
        delivery.id,
        new Date(Date.now() + 60_000).toISOString(),
        "Webhook endpoint is paused.",
        delivery.attemptCount,
      );
      return;
    }

    const payload = JSON.stringify(delivery.payload);
    const nextAttemptCount = delivery.attemptCount + 1;

    try {
      const result = await this.deliver({
        delivery,
        endpoint,
        payload,
        requestTimeoutMs: this.requestTimeoutMs,
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        this.repository.markWebhookDeliveryDelivered(
          delivery.id,
          new Date().toISOString(),
          nextAttemptCount,
        );
        return;
      }

      const error = `Webhook endpoint responded with status ${result.statusCode}.`;

      if (shouldRetryStatusCode(result.statusCode) && nextAttemptCount < this.maxAttempts) {
        this.repository.rescheduleWebhookDelivery(
          delivery.id,
          new Date(Date.now() + getRetryDelayMs(nextAttemptCount)).toISOString(),
          error,
          nextAttemptCount,
        );
        return;
      }

      this.repository.failWebhookDelivery(delivery.id, error, nextAttemptCount);
    } catch (error) {
      const message = toWebhookErrorMessage(error);

      if (nextAttemptCount < this.maxAttempts) {
        this.repository.rescheduleWebhookDelivery(
          delivery.id,
          new Date(Date.now() + getRetryDelayMs(nextAttemptCount)).toISOString(),
          message,
          nextAttemptCount,
        );
        return;
      }

      this.repository.failWebhookDelivery(delivery.id, message, nextAttemptCount);
    }
  }
}

async function deliverWebhookRequest(request: WebhookRequest): Promise<WebhookDeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.requestTimeoutMs);

  try {
    const response = await fetch(request.endpoint.url, {
      body: request.payload,
      headers: {
        "Content-Type": "application/json",
        "X-MikroLens-Delivery": request.delivery.id,
        "X-MikroLens-Event": request.delivery.eventType,
        "X-MikroLens-Signature": createWebhookSignature(request.endpoint.secret, request.payload),
      },
      method: "POST",
      signal: controller.signal,
    });

    return {
      statusCode: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function createWebhookSignature(secret: string, payload: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function shouldRetryStatusCode(statusCode: number): boolean {
  return statusCode >= 500 || statusCode === 408 || statusCode === 429;
}

function getRetryDelayMs(attemptCount: number): number {
  const delays = [30_000, 120_000, 600_000, 3_600_000, 21_600_000, 43_200_000];
  return delays[Math.min(attemptCount - 1, delays.length - 1)] ?? 43_200_000;
}

function toWebhookErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return "Unknown webhook delivery failure.";
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
