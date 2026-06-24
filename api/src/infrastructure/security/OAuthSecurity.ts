import { randomBytes } from "node:crypto";
import type { OAuthCallbackInput, OAuthRequestContext } from "../../application/ports/OAuth.ts";
import type { OAuthConfiguration, OAuthState, RateLimitRecord } from "../oauth/OAuthConfig.ts";

export class OAuthSecurity {
  private readonly rateLimitMaxAttempts: number;
  private readonly rateLimitStore = new Map<string, RateLimitRecord>();
  private readonly rateLimitWindowMs: number;
  private readonly stateCleanupInterval: NodeJS.Timeout;
  private readonly stateExpiryMs: number;
  private readonly stateStore = new Map<string, OAuthState>();
  private readonly rateLimitCleanupInterval: NodeJS.Timeout;

  constructor(config?: OAuthConfiguration) {
    this.stateExpiryMs = (config?.stateExpirySeconds || 600) * 1000;
    this.rateLimitMaxAttempts = config?.rateLimiting?.maxAttempts || 10;
    this.rateLimitWindowMs = config?.rateLimiting?.windowMs || 15 * 60 * 1000;

    this.stateCleanupInterval = setInterval(
      () => {
        this.cleanupExpiredStates();
      },
      5 * 60 * 1000,
    );
    this.rateLimitCleanupInterval = setInterval(
      () => {
        this.cleanupExpiredRateLimits();
      },
      10 * 60 * 1000,
    );
  }

  checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const record = this.rateLimitStore.get(identifier);

    if (!record || record.resetAt < now) {
      this.rateLimitStore.set(identifier, {
        count: 1,
        resetAt: now + this.rateLimitWindowMs,
      });
      return true;
    }

    if (record.count >= this.rateLimitMaxAttempts) {
      return false;
    }

    record.count += 1;
    return true;
  }

  generateState(context: OAuthRequestContext, providerId: string): string {
    const state = randomBytes(32).toString("hex");

    this.stateStore.set(state, {
      expires: Date.now() + this.stateExpiryMs,
      ip: context.ip,
      providerId,
      userAgent: context.userAgent,
    });

    return state;
  }

  getRateLimitInfo(identifier: string): { limit: number; remaining: number; reset: number } {
    const record = this.rateLimitStore.get(identifier);
    const now = Date.now();

    if (!record || record.resetAt < now) {
      return {
        limit: this.rateLimitMaxAttempts,
        remaining: this.rateLimitMaxAttempts - 1,
        reset: now + this.rateLimitWindowMs,
      };
    }

    return {
      limit: this.rateLimitMaxAttempts,
      remaining: Math.max(0, this.rateLimitMaxAttempts - record.count),
      reset: record.resetAt,
    };
  }

  shutdown(): void {
    clearInterval(this.stateCleanupInterval);
    clearInterval(this.rateLimitCleanupInterval);
  }

  validateCallback(
    context: OAuthRequestContext,
    providerId: string,
    callback: OAuthCallbackInput,
  ): { code?: string; error?: string; valid: boolean } {
    const error = callback.error?.trim() ?? "";
    const errorDescription = callback.errorDescription?.trim() ?? "";
    const code = callback.code?.trim() ?? "";
    const state = callback.state?.trim() ?? "";

    if (error) {
      return {
        error: `OAuth provider error: ${errorDescription || error}`,
        valid: false,
      };
    }

    if (!code || !state) {
      return {
        error: "Missing code or state parameter.",
        valid: false,
      };
    }

    const storedState = this.stateStore.get(state);

    if (!storedState) {
      return {
        error: "Invalid or expired state token.",
        valid: false,
      };
    }

    this.stateStore.delete(state);

    if (storedState.expires < Date.now()) {
      return {
        error: "OAuth sign-in expired. Please try again.",
        valid: false,
      };
    }

    if (storedState.providerId !== providerId) {
      return {
        error: "OAuth state does not match the selected provider.",
        valid: false,
      };
    }

    if (storedState.ip !== context.ip) {
      return {
        error: "OAuth state did not match this request.",
        valid: false,
      };
    }

    const userAgent = context.userAgent;

    if (storedState.userAgent && userAgent && storedState.userAgent !== userAgent) {
      return {
        error: "OAuth state did not match this browser.",
        valid: false,
      };
    }

    return {
      code,
      valid: true,
    };
  }

  private cleanupExpiredRateLimits(): void {
    const now = Date.now();

    for (const [identifier, record] of this.rateLimitStore.entries()) {
      if (record.resetAt < now) {
        this.rateLimitStore.delete(identifier);
      }
    }
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();

    for (const [state, record] of this.stateStore.entries()) {
      if (record.expires < now) {
        this.stateStore.delete(state);
      }
    }
  }
}
