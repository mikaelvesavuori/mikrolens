import { MikroConf, parsers } from "mikroconf";
import { configDefaults } from "./configDefaults.ts";
import { validateMikroLensConfig } from "./configValidation.ts";
import type { MikroLensConfiguration } from "./MikroLensConfiguration.ts";

const defaults = configDefaults();
const parseCommaSeparatedList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const mikrolensOptions = {
  args: process.argv,
  configFilePath: process.env.MIKROLENS_CONFIG_PATH?.trim() || "mikrolens.config.json",
  options: [
    {
      defaultValue: defaults.storage.databasePath,
      flag: "--db",
      path: "storage.databasePath",
    },
    {
      defaultValue: defaults.server.host,
      flag: "--host",
      path: "server.host",
    },
    {
      defaultValue: defaults.server.port,
      flag: "--port",
      parser: parsers.int,
      path: "server.port",
    },
    {
      defaultValue: defaults.server.staticRoot,
      flag: "--static-root",
      path: "server.staticRoot",
    },
    {
      defaultValue: defaults.server.allowedOrigins,
      flag: "--allowed-origins",
      parser: parseCommaSeparatedList,
      path: "server.allowedOrigins",
    },
    {
      defaultValue: defaults.auth.appUrl,
      flag: "--app-url",
      path: "auth.appUrl",
    },
    {
      defaultValue: defaults.auth.initialUser.name,
      flag: "--initial-user-name",
      path: "auth.initialUser.name",
    },
    {
      defaultValue: defaults.auth.initialUser.email,
      flag: "--initial-user-email",
      path: "auth.initialUser.email",
    },
    {
      defaultValue: defaults.auth.initialUser.role,
      flag: "--initial-user-role",
      path: "auth.initialUser.role",
    },
    {
      defaultValue: defaults.auth.magicLinkExpiryMinutes,
      flag: "--magic-link-expiry-minutes",
      parser: parsers.int,
      path: "auth.magicLinkExpiryMinutes",
    },
    {
      defaultValue: defaults.auth.jwtSecret,
      flag: "--auth-jwt-secret",
      path: "auth.jwtSecret",
    },
    {
      defaultValue: defaults.auth.jwtExpirySeconds,
      flag: "--auth-jwt-expiry-seconds",
      parser: parsers.int,
      path: "auth.jwtExpirySeconds",
    },
    {
      defaultValue: defaults.auth.refreshTokenExpirySeconds,
      flag: "--auth-refresh-token-expiry-seconds",
      parser: parsers.int,
      path: "auth.refreshTokenExpirySeconds",
    },
    {
      defaultValue: defaults.auth.maxActiveSessions,
      flag: "--auth-max-active-sessions",
      parser: parsers.int,
      path: "auth.maxActiveSessions",
    },
    {
      defaultValue: defaults.auth.sessionSecret,
      flag: "--session-secret",
      path: "auth.sessionSecret",
    },
    {
      defaultValue: defaults.auth.sessionCookieDomain,
      flag: "--session-cookie-domain",
      path: "auth.sessionCookieDomain",
    },
    {
      defaultValue: defaults.auth.sessionCookieSameSite,
      flag: "--session-cookie-same-site",
      path: "auth.sessionCookieSameSite",
    },
    {
      defaultValue: defaults.email.host,
      flag: "--email-host",
      path: "email.host",
    },
    {
      defaultValue: defaults.email.emailSubject,
      flag: "--email-subject",
      path: "email.emailSubject",
    },
    {
      defaultValue: defaults.demo.loginEnabled,
      flag: "--demo-login",
      isFlag: true,
      path: "demo.loginEnabled",
    },
    {
      defaultValue: defaults.demo.seedOnEmpty,
      flag: "--seed-demo-data",
      isFlag: true,
      path: "demo.seedOnEmpty",
    },
    {
      defaultValue: defaults.email.user,
      flag: "--email-user",
      path: "email.user",
    },
    {
      defaultValue: defaults.email.password,
      flag: "--email-password",
      path: "email.password",
    },
    {
      defaultValue: defaults.email.port,
      flag: "--email-port",
      parser: parsers.int,
      path: "email.port",
    },
    {
      defaultValue: defaults.email.secure,
      flag: "--email-secure",
      isFlag: true,
      path: "email.secure",
    },
    {
      defaultValue: defaults.email.debug,
      flag: "--email-debug",
      isFlag: true,
      path: "email.debug",
    },
    {
      defaultValue: defaults.email.maxRetries,
      flag: "--email-max-retries",
      parser: parsers.int,
      path: "email.maxRetries",
    },
    {
      defaultValue: defaults.webhooks.batchSize,
      flag: "--webhook-batch-size",
      parser: parsers.int,
      path: "webhooks.batchSize",
    },
    {
      defaultValue: defaults.webhooks.concurrency,
      flag: "--webhook-concurrency",
      parser: parsers.int,
      path: "webhooks.concurrency",
    },
    {
      defaultValue: defaults.webhooks.maxAttempts,
      flag: "--webhook-max-attempts",
      parser: parsers.int,
      path: "webhooks.maxAttempts",
    },
    {
      defaultValue: defaults.webhooks.pollIntervalMs,
      flag: "--webhook-poll-interval-ms",
      parser: parsers.int,
      path: "webhooks.pollIntervalMs",
    },
    {
      defaultValue: defaults.webhooks.requestTimeoutMs,
      flag: "--webhook-timeout-ms",
      parser: parsers.int,
      path: "webhooks.requestTimeoutMs",
    },
    {
      defaultValue: defaults.webhooks.staleClaimTimeoutMs,
      flag: "--webhook-stale-claim-ms",
      parser: parsers.int,
      path: "webhooks.staleClaimTimeoutMs",
    },
    {
      defaultValue: defaults.webhooks.workerId,
      flag: "--webhook-worker-id",
      path: "webhooks.workerId",
    },
  ],
};

export function getMikroLensConfig(
  overrides?: Partial<{
    args: string[];
    config: Partial<MikroLensConfiguration>;
    configFilePath: string;
  }>,
) {
  const conf = new MikroConf({
    ...mikrolensOptions,
    args: overrides?.args ?? mikrolensOptions.args,
    config: overrides?.config,
    configFilePath: overrides?.configFilePath ?? mikrolensOptions.configFilePath,
  });

  return validateMikroLensConfig(conf.get<MikroLensConfiguration>());
}
