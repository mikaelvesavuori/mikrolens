import { OAuthSecurity } from "../../../src/infrastructure/security/OAuthSecurity.ts";

describe("OAuthSecurity", () => {
  it("enforces the rate-limit window and allows requests again after it resets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const security = new OAuthSecurity({
      rateLimiting: {
        maxAttempts: 2,
        windowMs: 1_000,
      },
    });

    try {
      expect(security.checkRateLimit("203.0.113.10")).toBe(true);
      expect(security.checkRateLimit("203.0.113.10")).toBe(true);
      expect(security.checkRateLimit("203.0.113.10")).toBe(false);
      expect(security.getRateLimitInfo("203.0.113.10")).toMatchObject({
        limit: 2,
        remaining: 0,
      });

      vi.advanceTimersByTime(1_001);

      expect(security.checkRateLimit("203.0.113.10")).toBe(true);
    } finally {
      security.shutdown();
      vi.useRealTimers();
    }
  });

  it("validates callback state once and rejects replays", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const security = new OAuthSecurity();
    const context = {
      ip: "203.0.113.10",
      userAgent: "vitest",
    };
    const state = security.generateState(context, "acme");

    try {
      expect(
        security.validateCallback(context, "acme", {
          code: "oauth-code",
          state,
        }),
      ).toEqual({
        code: "oauth-code",
        valid: true,
      });
      expect(
        security.validateCallback(context, "acme", {
          code: "oauth-code",
          state,
        }),
      ).toEqual({
        error: "Invalid or expired state token.",
        valid: false,
      });
    } finally {
      security.shutdown();
      vi.useRealTimers();
    }
  });

  it("rejects callbacks when the provider or browser context does not match", () => {
    const security = new OAuthSecurity();

    try {
      const providerState = security.generateState(
        {
          ip: "203.0.113.10",
          userAgent: "vitest",
        },
        "acme",
      );
      const browserState = security.generateState(
        {
          ip: "203.0.113.10",
          userAgent: "vitest",
        },
        "acme",
      );

      expect(
        security.validateCallback(
          {
            ip: "203.0.113.10",
            userAgent: "vitest",
          },
          "github",
          {
            code: "oauth-code",
            state: providerState,
          },
        ),
      ).toEqual({
        error: "OAuth state does not match the selected provider.",
        valid: false,
      });
      expect(
        security.validateCallback(
          {
            ip: "203.0.113.10",
            userAgent: "another-browser",
          },
          "acme",
          {
            code: "oauth-code",
            state: browserState,
          },
        ),
      ).toEqual({
        error: "OAuth state did not match this browser.",
        valid: false,
      });
    } finally {
      security.shutdown();
    }
  });

  it("rejects expired states and provider-reported OAuth errors", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    const security = new OAuthSecurity({
      stateExpirySeconds: 1,
    });
    const state = security.generateState(
      {
        ip: "203.0.113.10",
        userAgent: "vitest",
      },
      "acme",
    );

    try {
      expect(
        security.validateCallback(
          {
            ip: "203.0.113.10",
            userAgent: "vitest",
          },
          "acme",
          {
            error: "access_denied",
            errorDescription: "The provider rejected the request.",
          },
        ),
      ).toEqual({
        error: "OAuth provider error: The provider rejected the request.",
        valid: false,
      });

      vi.advanceTimersByTime(1_001);

      expect(
        security.validateCallback(
          {
            ip: "203.0.113.10",
            userAgent: "vitest",
          },
          "acme",
          {
            code: "oauth-code",
            state,
          },
        ),
      ).toEqual({
        error: "OAuth sign-in expired. Please try again.",
        valid: false,
      });
    } finally {
      security.shutdown();
      vi.useRealTimers();
    }
  });
});
