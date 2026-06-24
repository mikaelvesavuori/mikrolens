import type { IncomingMessage } from "node:http";
import {
  getOAuthRequestContext,
  getOAuthRoute,
  getRequestIp,
  getRequestUserAgent,
  getWorkItemFilters,
  isValidEmail,
  isValidWebhookUrl,
  parseSignalUrgency,
  parseWebhookSubscriptions,
  sanitizeWebhookEndpoint,
} from "../../../src/infrastructure/http/httpAdapters.ts";

describe("httpAdapters", () => {
  it("parses oauth routes and callback variants", () => {
    expect(getOAuthRoute("/auth/oauth/google")).toEqual({
      isCallback: false,
      providerId: "google",
    });
    expect(getOAuthRoute("/auth/oauth/github/callback")).toEqual({
      isCallback: true,
      providerId: "github",
    });
    expect(getOAuthRoute("/auth/login")).toBeNull();
  });

  it("prefers forwarded IP headers when present", () => {
    const request = {
      headers: {
        "user-agent": "vitest",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-real-ip": "198.51.100.22",
      },
    } as unknown as IncomingMessage;

    expect(getRequestIp(request)).toBe("203.0.113.10");
    expect(getRequestUserAgent(request)).toBe("vitest");
    expect(getOAuthRequestContext(request)).toEqual({
      ip: "203.0.113.10",
      userAgent: "vitest",
    });
  });

  it("parses work item filters and drops invalid enum values", () => {
    const url = new URL(
      "http://localhost/api/work-items?state=Active&type=Task&horizonName=Next&horizonKey=horizon_2&blocked=true&stale=false&search=ops&spaceId=space_platform&ownerName=Sara&ownerUserId=user_sara&source=planned&createdAfter=2026-04-01T00:00:00.000Z&createdBefore=2026-04-30T23:59:59.999Z&updatedAfter=2026-04-01T00:00:00.000Z&updatedBefore=2026-04-30T23:59:59.999Z&targetEndAfter=2026-04-07&targetEndBefore=2026-04-14&limit=25&offset=50&sortBy=updatedAt&sortDirection=asc",
    );

    expect(getWorkItemFilters(url)).toEqual({
      blocked: true,
      createdAfter: "2026-04-01T00:00:00.000Z",
      createdBefore: "2026-04-30T23:59:59.999Z",
      horizonKey: "horizon_2",
      horizonName: "Next",
      limit: 25,
      onlyRoadmap: undefined,
      offset: 50,
      ownerName: "Sara",
      ownerUserId: "user_sara",
      search: "ops",
      spaceId: "space_platform",
      stale: false,
      state: "Active",
      sortBy: "updatedAt",
      sortDirection: "asc",
      source: "planned",
      targetEndAfter: "2026-04-07",
      targetEndBefore: "2026-04-14",
      type: "Task",
      updatedAfter: "2026-04-01T00:00:00.000Z",
      updatedBefore: "2026-04-30T23:59:59.999Z",
    });

    const invalidUrl = new URL(
      "http://localhost/api/work-items?state=Wrong&type=Nope&horizonName=Soon&horizonKey=bad_key&source=unexpected&limit=-1&offset=-1&sortBy=bogus&sortDirection=sideways",
    );

    expect(getWorkItemFilters(invalidUrl)).toEqual({
      blocked: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      horizonKey: undefined,
      horizonName: "Soon",
      limit: undefined,
      onlyRoadmap: undefined,
      offset: undefined,
      ownerName: undefined,
      ownerUserId: undefined,
      search: undefined,
      spaceId: undefined,
      stale: undefined,
      state: undefined,
      sortBy: undefined,
      sortDirection: undefined,
      source: undefined,
      targetEndAfter: undefined,
      targetEndBefore: undefined,
      type: undefined,
      updatedAfter: undefined,
      updatedBefore: undefined,
    });
  });

  it("normalizes signal and webhook adapter input", () => {
    expect(parseSignalUrgency("High")).toBe("High");
    expect(parseSignalUrgency("Urgent")).toBeUndefined();
    expect(parseWebhookSubscriptions(["work-item.created", " work-item.created ", "", 5])).toEqual([
      "work-item.created",
    ]);
  });

  it("sanitizes webhook output and validates common inputs", () => {
    expect(
      sanitizeWebhookEndpoint({
        createdAt: "2024-01-01T00:00:00.000Z",
        id: "webhook_1",
        name: "Ops",
        secret: "super-secret",
        spaceId: "space_platform",
        status: "Active",
        subscribedEvents: ["work-item.created"],
        updatedAt: "2024-01-01T00:00:00.000Z",
        url: "https://example.com/webhook",
      }),
    ).toMatchObject({
      id: "webhook_1",
      secret: "",
    });

    expect(isValidWebhookUrl("https://example.com/webhook")).toBe(true);
    expect(isValidWebhookUrl("ftp://example.com/webhook")).toBe(false);
    expect(isValidEmail("sam.person@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});
