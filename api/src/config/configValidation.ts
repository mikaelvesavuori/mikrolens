import { MikroValid } from "mikrovalid";
import type { MikroLensConfiguration } from "./MikroLensConfiguration.ts";

const configSchema = {
  properties: {
    auth: {
      appUrl: { type: "string" },
      initialUser: {
        email: { type: "string" },
        name: { type: "string" },
        required: ["email", "name", "role"],
        role: { type: "string" },
        type: "object",
      },
      jwtExpirySeconds: { minValue: 60, type: "number" },
      jwtSecret: { minLength: 32, type: "string" },
      magicLinkExpiryMinutes: { minValue: 1, type: "number" },
      maxActiveSessions: { minValue: 1, type: "number" },
      refreshTokenExpirySeconds: { minValue: 60, type: "number" },
      required: [
        "appUrl",
        "initialUser",
        "jwtExpirySeconds",
        "jwtSecret",
        "magicLinkExpiryMinutes",
        "maxActiveSessions",
        "refreshTokenExpirySeconds",
        "sessionCookieDomain",
        "sessionCookieSameSite",
        "sessionSecret",
      ],
      sessionCookieDomain: { type: "string" },
      sessionCookieSameSite: { type: "string" },
      sessionSecret: { minLength: 16, type: "string" },
      type: "object",
    },
    email: {
      debug: { type: "boolean" },
      emailSubject: { type: "string" },
      host: { type: "string" },
      maxRetries: { minValue: 0, type: "number" },
      password: { type: "string" },
      port: { minValue: 1, type: "number" },
      required: [
        "debug",
        "emailSubject",
        "host",
        "maxRetries",
        "password",
        "port",
        "secure",
        "user",
      ],
      secure: { type: "boolean" },
      type: "object",
      user: { type: "string" },
    },
    demo: {
      loginEnabled: { type: "boolean" },
      required: ["loginEnabled", "seedOnEmpty"],
      seedOnEmpty: { type: "boolean" },
      type: "object",
    },
    required: ["auth", "demo", "email", "server", "storage", "webhooks"],
    server: {
      allowedOrigins: {
        items: { type: "string" },
        type: "array",
      },
      host: { type: "string" },
      port: { maxValue: 65535, minValue: 1, type: "number" },
      required: ["allowedOrigins", "host", "port", "staticRoot"],
      staticRoot: { type: "string" },
      type: "object",
    },
    storage: {
      databasePath: { type: "string" },
      required: ["databasePath"],
      type: "object",
    },
    webhooks: {
      batchSize: { minValue: 1, type: "number" },
      concurrency: { minValue: 1, type: "number" },
      maxAttempts: { minValue: 1, type: "number" },
      pollIntervalMs: { minValue: 100, type: "number" },
      requestTimeoutMs: { minValue: 100, type: "number" },
      required: [
        "batchSize",
        "concurrency",
        "maxAttempts",
        "pollIntervalMs",
        "requestTimeoutMs",
        "staleClaimTimeoutMs",
        "workerId",
      ],
      staleClaimTimeoutMs: { minValue: 1000, type: "number" },
      type: "object",
      workerId: { type: "string" },
    },
  },
};

const validSameSiteValues = new Set(["auto", "lax", "none", "strict"]);
const validInitialUserRoles = new Set(["Admin", "User"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function validateMikroLensConfig(config: MikroLensConfiguration): MikroLensConfiguration {
  const mikroValid = new MikroValid(true);
  const result = mikroValid.test(
    configSchema as never,
    config as unknown as Record<string, unknown>,
  );
  const errors = result.errors.map((error) => `${error.key}: ${error.error}`);

  if (!validSameSiteValues.has(config.auth.sessionCookieSameSite)) {
    errors.push("auth.sessionCookieSameSite: must be auto, lax, none, or strict");
  }

  if (!validInitialUserRoles.has(config.auth.initialUser.role)) {
    errors.push("auth.initialUser.role: must be Admin or User");
  }

  if (hasInitialUserConfig(config.auth.initialUser)) {
    if (!config.auth.initialUser.email.trim()) {
      errors.push("auth.initialUser.email: required when configuring an initial user");
    } else if (!emailPattern.test(config.auth.initialUser.email.trim().toLowerCase())) {
      errors.push("auth.initialUser.email: must be a valid email address");
    }
  }

  for (const [key, value] of [
    ["auth.appUrl", config.auth.appUrl],
    ...config.server.allowedOrigins.map((origin, index) => [
      `server.allowedOrigins.${index}`,
      origin,
    ]),
  ] as const) {
    if (value.trim() && !isValidUrl(value)) {
      errors.push(`${key}: must be an absolute URL`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`MikroLens configuration is invalid: ${errors.join("; ")}`);
  }

  return config;
}

function hasInitialUserConfig(initialUser: MikroLensConfiguration["auth"]["initialUser"]): boolean {
  return Boolean(initialUser.email.trim() || initialUser.name.trim());
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
