import type { IncomingMessage } from "node:http";
import type { OAuthRequestContext } from "../../application/ports/OAuth.ts";
import type {
  QuerySortDirection,
  WorkItemQueryFilters,
  WorkItemSortField,
} from "../../application/queries/WorkItemFilters.ts";
import { isHorizonKey } from "../../domain/Horizon.ts";
import type { SignalUrgency } from "../../domain/Signal.ts";
import { isSignalUrgency } from "../../domain/Signal.ts";
import type { WebhookEndpoint } from "../../domain/Webhook.ts";
import { isWorkflowState, isWorkItemSource, isWorkItemType } from "../../domain/WorkItem.ts";
import { parseBoolean } from "./httpUtils.ts";

export { isValidEmail } from "../../domain/User.ts";
export { isValidWebhookUrl } from "../../domain/Webhook.ts";

export function getOAuthRoute(
  pathname: string,
): { isCallback: boolean; providerId: string } | null {
  const match = pathname.match(/^\/auth\/oauth\/([^/]+?)(\/callback)?\/?$/u);

  if (!match) {
    return null;
  }

  return {
    isCallback: Boolean(match[2]),
    providerId: decodeURIComponent(match[1] ?? ""),
  };
}

export function getRequestIp(request: IncomingMessage): string {
  const forwardedFor = request.headers["x-forwarded-for"];
  const firstForwardedFor = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const realIp = request.headers["x-real-ip"];
  const firstRealIp = Array.isArray(realIp) ? realIp[0] : realIp;

  return firstForwardedFor?.split(",")[0]?.trim() || firstRealIp || "unknown";
}

export function getRequestUserAgent(request: IncomingMessage): string {
  const userAgent = request.headers["user-agent"];

  return Array.isArray(userAgent) ? userAgent[0] || "" : userAgent || "";
}

export function getOAuthRequestContext(request: IncomingMessage): OAuthRequestContext {
  return {
    ip: getRequestIp(request),
    userAgent: getRequestUserAgent(request),
  };
}

export function parseSignalUrgency(value?: string | null): SignalUrgency | undefined {
  if (!value) {
    return undefined;
  }

  return isSignalUrgency(value) ? value : undefined;
}

export function getWorkItemFilters(url: URL): WorkItemQueryFilters {
  const state = url.searchParams.get("state");
  const type = url.searchParams.get("type");
  const horizonName = url.searchParams.get("horizonName")?.trim() ?? "";
  const horizonKey = url.searchParams.get("horizonKey");
  const source = url.searchParams.get("source");
  const sortBy = parseWorkItemSortField(url.searchParams.get("sortBy"));
  const sortDirection = parseSortDirection(url.searchParams.get("sortDirection"));

  return {
    blocked: parseBoolean(url.searchParams.get("blocked")),
    createdAfter: readQueryText(url.searchParams.get("createdAfter")),
    createdBefore: readQueryText(url.searchParams.get("createdBefore")),
    horizonName: horizonName || undefined,
    horizonKey: horizonKey && isHorizonKey(horizonKey) ? horizonKey : undefined,
    limit: parsePositiveInteger(url.searchParams.get("limit")),
    onlyRoadmap: parseBoolean(url.searchParams.get("onlyRoadmap")),
    offset: parseNonNegativeInteger(url.searchParams.get("offset")),
    ownerName: readQueryText(url.searchParams.get("ownerName")),
    ownerUserId: readQueryText(url.searchParams.get("ownerUserId")),
    search: url.searchParams.get("search") ?? undefined,
    spaceId: url.searchParams.get("spaceId") ?? undefined,
    stale: parseBoolean(url.searchParams.get("stale")),
    state: state && isWorkflowState(state) ? state : undefined,
    sortBy,
    sortDirection,
    source: source && isWorkItemSource(source) ? source : undefined,
    targetEndAfter: readQueryText(url.searchParams.get("targetEndAfter")),
    targetEndBefore: readQueryText(url.searchParams.get("targetEndBefore")),
    type: type && isWorkItemType(type) ? type : undefined,
    updatedAfter: readQueryText(url.searchParams.get("updatedAfter")),
    updatedBefore: readQueryText(url.searchParams.get("updatedBefore")),
  };
}

export function parseWebhookSubscriptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => Boolean(entry)),
    ),
  );
}

export function sanitizeWebhookEndpoint(webhook: WebhookEndpoint): WebhookEndpoint {
  return {
    ...webhook,
    secret: "",
  };
}

function parsePositiveInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.min(parsed, 200);
}

function parseNonNegativeInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function parseWorkItemSortField(value: string | null): WorkItemSortField | undefined {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return undefined;
  }

  const allowedFields = new Set<WorkItemSortField>([
    "createdAt",
    "ref",
    "state",
    "targetEndDate",
    "title",
    "updatedAt",
  ]);

  return allowedFields.has(normalized as WorkItemSortField)
    ? (normalized as WorkItemSortField)
    : undefined;
}

function parseSortDirection(value: string | null): QuerySortDirection | undefined {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return undefined;
  }

  return normalized === "asc" || normalized === "desc"
    ? (normalized as QuerySortDirection)
    : undefined;
}

function readQueryText(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";

  return trimmed || undefined;
}
