import {
  createDefaultApiIdentityAccessPolicy,
  createDefaultUserAccessPolicy,
  createFullAccessPolicy,
  isAccessLevel,
} from "../../src/domain/AccessPolicy.ts";
import { isApiIdentityStatus } from "../../src/domain/ApiIdentity.ts";
import { isDocumentType } from "../../src/domain/Document.ts";
import {
  builtInHorizonDefinition,
  getBuiltInHorizonDefaults,
  isHorizonKey,
  orderIndexForHorizonKey,
} from "../../src/domain/Horizon.ts";
import { isSignalUrgency } from "../../src/domain/Signal.ts";
import { isUserRole, isValidEmail } from "../../src/domain/User.ts";
import { isValidWebhookUrl, isWebhookEndpointStatus } from "../../src/domain/Webhook.ts";
import {
  ageInDays,
  isBlocked,
  isStale,
  isWorkflowState,
  isWorkItemType,
} from "../../src/domain/WorkItem.ts";

describe("domain helpers", () => {
  it("builds and narrows access policies consistently", () => {
    expect(isAccessLevel("admin")).toBe(true);
    expect(isAccessLevel("owner")).toBe(false);
    expect(createFullAccessPolicy("viewer")).toEqual({
      boards: {
        level: "viewer",
        scope: "all",
      },
      documents: "viewer",
      signals: "viewer",
    });
    expect(createDefaultUserAccessPolicy("User")).toEqual(createFullAccessPolicy("editor"));
    expect(createDefaultUserAccessPolicy("Admin")).toEqual(createFullAccessPolicy("admin"));
    expect(createDefaultApiIdentityAccessPolicy()).toEqual(createFullAccessPolicy("viewer"));
  });

  it("covers the shared string guards used around the domain", () => {
    expect(isApiIdentityStatus("Paused")).toBe(true);
    expect(isApiIdentityStatus("Archived")).toBe(false);
    expect(isDocumentType("Strategy")).toBe(true);
    expect(isDocumentType("Memo")).toBe(false);
    expect(isHorizonKey("horizon_1")).toBe(true);
    expect(isHorizonKey("horizon_4")).toBe(false);
    expect(isSignalUrgency("High")).toBe(true);
    expect(isSignalUrgency("Urgent")).toBe(false);
    expect(isUserRole("Admin")).toBe(true);
    expect(isUserRole("Owner")).toBe(false);
    expect(isWorkflowState("Blocked")).toBe(true);
    expect(isWorkflowState("Queued")).toBe(false);
    expect(isWorkItemType("Bug")).toBe(true);
    expect(isWorkItemType("Epic")).toBe(false);
    expect(isWebhookEndpointStatus("Active")).toBe(true);
    expect(isWebhookEndpointStatus("Revoked")).toBe(false);
  });

  it("exposes planning defaults", () => {
    expect(orderIndexForHorizonKey("horizon_1")).toBe(0);
    expect(orderIndexForHorizonKey("horizon_2")).toBe(1);
    expect(orderIndexForHorizonKey("horizon_3")).toBe(2);
    expect(builtInHorizonDefinition("horizon_1")).toMatchObject({
      label: "Now",
      timeframeText: "Current work and near-term pull decisions.",
    });
    expect(builtInHorizonDefinition("horizon_3").description).toContain("Longer-range");
    expect(getBuiltInHorizonDefaults("2024-01-01T00:00:00.000Z")).toHaveLength(3);
  });

  it("validates webhook URLs and email syntax", () => {
    expect(isValidWebhookUrl("https://example.com/webhooks/platform")).toBe(true);
    expect(isValidWebhookUrl("http://localhost:3000/webhooks")).toBe(true);
    expect(isValidWebhookUrl("ftp://example.com/webhooks")).toBe(false);
    expect(isValidWebhookUrl("javascript:alert(1)")).toBe(false);
    expect(isValidEmail("sam.person@example.com")).toBe(true);
    expect(isValidEmail(" Sam.Person@Example.com ")).toBe(true);
    expect(isValidEmail("sam.person")).toBe(false);
  });

  it("computes work-item age and staleness thresholds in isolation", () => {
    const now = new Date("2024-01-10T00:00:00.000Z");

    expect(ageInDays("2024-01-08T00:00:00.000Z", now)).toBe(2);
    expect(ageInDays("2024-01-12T00:00:00.000Z", now)).toBe(0);
    expect(
      isBlocked({
        blockedReason: "Waiting on a dependency",
        state: "Blocked",
      }),
    ).toBe(true);
    expect(
      isBlocked({
        blockedReason: "",
        state: "Active",
      }),
    ).toBe(false);
    expect(
      isStale(
        {
          lastTouchedAt: "2024-01-02T00:00:00.000Z",
          state: "Active",
        },
        now,
      ),
    ).toBe(true);
    expect(
      isStale(
        {
          lastTouchedAt: "2024-01-03T00:00:00.000Z",
          state: "Active",
        },
        now,
      ),
    ).toBe(false);
  });
});
