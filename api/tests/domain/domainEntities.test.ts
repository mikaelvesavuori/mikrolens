import { createFullAccessPolicy } from "../../src/domain/AccessPolicy.ts";
import { ApiIdentity } from "../../src/domain/ApiIdentity.ts";
import { Document } from "../../src/domain/Document.ts";
import { getBuiltInHorizonDefaults, Horizon } from "../../src/domain/Horizon.ts";
import { Signal } from "../../src/domain/Signal.ts";
import { Space } from "../../src/domain/Space.ts";
import { User } from "../../src/domain/User.ts";

describe("domain entities", () => {
  it("normalizes and updates space metadata through Space", () => {
    const created = Space.create({
      id: "space_1",
      name: " Platform ",
      now: "2024-01-01T00:00:00.000Z",
    }).toDTO();
    const updated = Space.rehydrate(created)
      .updateDetails({
        accent: " #0f766e ",
        description: " Shared systems and delivery work. ",
        name: " Platform Core ",
        now: "2024-01-02T00:00:00.000Z",
      })
      .toDTO();

    expect(created.name).toBe("Platform");
    expect(created.description).toBe("Platform workspace.");
    expect(updated.name).toBe("Platform Core");
    expect(updated.description).toBe("Shared systems and delivery work.");
    expect(updated.accent).toBe("#0f766e");
  });

  it("keeps existing space details when blank updates are supplied", () => {
    const created = Space.create({
      accent: "#0f766e",
      description: "Shared systems and delivery work.",
      id: "space_2",
      name: "Platform",
      now: "2024-01-01T00:00:00.000Z",
    }).toDTO();
    const updated = Space.rehydrate(created)
      .updateDetails({
        accent: "   ",
        description: "   ",
        name: "   ",
        now: "2024-01-02T00:00:00.000Z",
      })
      .toDTO();

    expect(updated.name).toBe("Platform");
    expect(updated.description).toBe("Shared systems and delivery work.");
    expect(updated.accent).toBe("#0f766e");
  });

  it("owns signal lifecycle transitions through Signal", () => {
    const created = Signal.create({
      expectedTimeline: " This quarter ",
      id: "signal_1",
      now: "2024-01-01T00:00:00.000Z",
      ref: "SIG-1",
      source: " Mikael ",
      title: " Add stronger modeling ",
    }).toDTO();
    const updated = Signal.rehydrate(created)
      .updateDetails({
        now: "2024-01-02T00:00:00.000Z",
        summary: " Keep the application layer thinner. ",
        urgency: "High",
      })
      .toDTO();
    const pulled = Signal.rehydrate(updated)
      .markPulled("2024-01-03T00:00:00.000Z", "work_item_1")
      .toDTO();
    const reopened = Signal.rehydrate(pulled).reopen("2024-01-04T00:00:00.000Z").toDTO();

    expect(created.source).toBe("Mikael");
    expect(created.status).toBe("Open");
    expect(updated.summary).toBe("Keep the application layer thinner.");
    expect(pulled.status).toBe("Pulled");
    expect(pulled.pulledIntoWorkItemId).toBe("work_item_1");
    expect(reopened.status).toBe("Open");
    expect(reopened.pulledAt).toBeNull();
    expect(reopened.pulledIntoWorkItemId).toBeNull();
  });

  it("applies signal defaults, allows timeline clearing, and blocks duplicate pulls", () => {
    const created = Signal.create({
      id: "signal_2",
      now: "2024-01-01T00:00:00.000Z",
      ref: "SIG-2",
      source: " Lea ",
      title: " Add a shared capture flow ",
    }).toDTO();
    const updated = Signal.rehydrate(created)
      .updateDetails({
        expectedTimeline: "   ",
        now: "2024-01-02T00:00:00.000Z",
        source: "   ",
        summary: "   ",
        title: "   ",
      })
      .toDTO();
    const pulled = Signal.rehydrate(updated)
      .markPulled("2024-01-03T00:00:00.000Z", "work_item_2")
      .toDTO();

    expect(created.summary).toContain("Captured without extra ceremony");
    expect(created.urgency).toBe("Medium");
    expect(updated.expectedTimeline).toBeNull();
    expect(updated.source).toBe("Lea");
    expect(updated.title).toBe("Add a shared capture flow");
    expect(() =>
      Signal.rehydrate(pulled).markPulled("2024-01-04T00:00:00.000Z", "work_item_3"),
    ).toThrow("Signal has already been pulled.");
  });

  it("creates and updates editorial document state through Document", () => {
    const created = Document.create({
      id: "document_1",
      markdown: "# Decision\n\nInitial context",
      now: "2024-01-01T00:00:00.000Z",
      spaceId: "space_platform",
      summary: "Initial rationale",
      title: "Decision log",
      type: "Note",
    }).toDTO();
    const updated = Document.rehydrate(created)
      .applyEditorialUpdate({
        horizonId: "horizon_next",
        markdown: "# Decision\n\nRefined context",
        now: "2024-01-02T00:00:00.000Z",
        title: "Decision log v2",
        type: "Strategy",
      })
      .toDTO();

    expect(updated.title).toBe("Decision log v2");
    expect(updated.type).toBe("Strategy");
    expect(updated.horizonId).toBe("horizon_next");
    expect(updated.markdown).toContain("Refined context");
  });

  it("supports standalone documents, preserves content on blank edits, and rejects empty markdown", () => {
    const created = Document.create({
      id: "document_2",
      markdown: " # Decision\n\nInitial context ",
      now: "2024-01-01T00:00:00.000Z",
      spaceId: "   ",
      summary: "   ",
      title: " Decision log ",
      type: "Note",
    }).toDTO();
    const updated = Document.rehydrate(created)
      .applyEditorialUpdate({
        horizonId: null,
        markdown: "   ",
        now: "2024-01-02T00:00:00.000Z",
        summary: " Sharper rationale ",
        title: "   ",
      })
      .toDTO();

    expect(created.spaceId).toBeNull();
    expect(created.summary).toBe("");
    expect(created.markdown).toBe("# Decision\n\nInitial context");
    expect(updated.horizonId).toBeNull();
    expect(updated.markdown).toBe("# Decision\n\nInitial context");
    expect(updated.summary).toBe("Sharper rationale");
    expect(updated.title).toBe("Decision log");
    expect(() =>
      Document.create({
        id: "document_3",
        markdown: "   ",
        now: "2024-01-01T00:00:00.000Z",
        summary: "",
        title: "Invalid document",
        type: "Note",
      }),
    ).toThrow("Document markdown is required.");
  });

  it("models horizon defaults and presentation updates through Horizon", () => {
    const defaults = getBuiltInHorizonDefaults("2024-01-01T00:00:00.000Z");
    const nextDefaults = defaults.find((entry) => entry.key === "horizon_2");

    if (!nextDefaults) {
      throw new Error("Expected built-in default for horizon_2.");
    }

    const created = Horizon.create(
      {
        id: "horizon_1",
        key: "horizon_2",
        now: "2024-01-01T00:00:00.000Z",
        spaceId: "space_platform",
      },
      nextDefaults,
    ).toDTO();
    const updated = Horizon.rehydrate(created)
      .updateDetails(
        {
          description: " Upcoming platform commitments. ",
          label: "Soon",
          now: "2024-01-02T00:00:00.000Z",
          timeframeText: "Roughly the next few planning cycles.",
        },
        nextDefaults,
      )
      .toDTO();

    expect(created.orderIndex).toBe(1);
    expect(created.label).toBe("Next");
    expect(created.timeframeText).toBe("Likely next work once ready enough to pull.");
    expect(updated.label).toBe("Soon");
    expect(updated.description).toBe("Upcoming platform commitments.");
    expect(updated.timeframeText).toBe("Roughly the next few planning cycles.");
    expect(updated.inheritsDefault).toBe(false);
  });

  it("can reset horizon presentation back to inherited defaults", () => {
    const defaults = getBuiltInHorizonDefaults("2024-01-01T00:00:00.000Z");
    const laterDefaults = defaults.find((entry) => entry.key === "horizon_3");

    if (!laterDefaults) {
      throw new Error("Expected built-in default for horizon_3.");
    }

    const created = Horizon.create(
      {
        id: "horizon_2",
        key: "horizon_3",
        now: "2024-01-01T00:00:00.000Z",
        spaceId: "space_platform",
      },
      laterDefaults,
    ).toDTO();
    const customized = Horizon.rehydrate(created)
      .updateDetails(
        {
          description: " Custom distant planning lane. ",
          label: "Someday",
          now: "2024-01-02T00:00:00.000Z",
          timeframeText: "Far enough out that exact dates are still fuzzy.",
        },
        laterDefaults,
      )
      .toDTO();
    const reset = Horizon.rehydrate(customized)
      .updateDetails(
        {
          now: "2024-01-03T00:00:00.000Z",
          useDefaults: true,
        },
        laterDefaults,
      )
      .toDTO();

    expect(customized.label).toBe("Someday");
    expect(customized.inheritsDefault).toBe(false);
    expect(reset.label).toBe("Later");
    expect(reset.description).toBe(laterDefaults.description);
    expect(reset.timeframeText).toBe(laterDefaults.timeframeText);
    expect(reset.inheritsDefault).toBe(true);
  });

  it("models invite, profile updates, and sign-in through User", () => {
    const invited = User.invite({
      email: "  Mikael@Example.com ",
      id: "user_1",
      now: "2024-01-01T00:00:00.000Z",
    }).toDTO();
    const updated = User.rehydrate(invited)
      .updateProfile({
        name: " Mikael ",
        now: "2024-01-02T00:00:00.000Z",
        role: "Admin",
      })
      .toDTO();
    const active = User.rehydrate(updated).recordSignIn("2024-01-03T00:00:00.000Z").toDTO();

    expect(invited.email).toBe("mikael@example.com");
    expect(invited.status).toBe("Invited");
    expect(updated.name).toBe("Mikael");
    expect(updated.role).toBe("Admin");
    expect(active.status).toBe("Active");
    expect(active.activatedAt).toBe("2024-01-03T00:00:00.000Z");
    expect(active.lastSignedInAt).toBe("2024-01-03T00:00:00.000Z");
  });

  it("applies role-based default permissions, allows clearing names, and preserves activation time", () => {
    const invited = User.invite({
      email: "admin@example.com",
      id: "user_2",
      name: " Admin Person ",
      now: "2024-01-01T00:00:00.000Z",
      role: "Admin",
    }).toDTO();
    const clearedName = User.rehydrate(invited)
      .updateProfile({
        name: "   ",
        now: "2024-01-02T00:00:00.000Z",
      })
      .toDTO();
    const firstSignIn = User.rehydrate(clearedName)
      .recordSignIn("2024-01-03T00:00:00.000Z")
      .toDTO();
    const secondSignIn = User.rehydrate(firstSignIn)
      .recordSignIn("2024-01-04T00:00:00.000Z")
      .toDTO();

    expect(invited.permissions).toEqual(createFullAccessPolicy("admin"));
    expect(clearedName.name).toBeNull();
    expect(secondSignIn.activatedAt).toBe("2024-01-03T00:00:00.000Z");
    expect(secondSignIn.lastSignedInAt).toBe("2024-01-04T00:00:00.000Z");
    expect(() =>
      User.invite({
        email: "not-an-email",
        id: "user_3",
        now: "2024-01-01T00:00:00.000Z",
      }),
    ).toThrow("Email must be valid.");
  });

  it("models provisioning, updates, rotation, and usage through ApiIdentity", () => {
    const provisioned = ApiIdentity.provision({
      id: "api_identity_1",
      name: " Release Bot ",
      now: "2024-01-01T00:00:00.000Z",
    }).toDTO();
    const updated = ApiIdentity.rehydrate(provisioned)
      .updateDetails({
        description: " Publishes release notes. ",
        now: "2024-01-02T00:00:00.000Z",
        status: "Paused",
      })
      .toDTO();
    const rotated = ApiIdentity.rehydrate(updated)
      .recordTokenRotation("2024-01-03T00:00:00.000Z")
      .toDTO();
    const used = ApiIdentity.rehydrate(rotated).recordUsage("2024-01-04T00:00:00.000Z").toDTO();

    expect(provisioned.name).toBe("Release Bot");
    expect(provisioned.tokenLastRotatedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(updated.description).toBe("Publishes release notes.");
    expect(updated.status).toBe("Paused");
    expect(rotated.tokenLastRotatedAt).toBe("2024-01-03T00:00:00.000Z");
    expect(used.lastUsedAt).toBe("2024-01-04T00:00:00.000Z");
  });

  it("applies default API identity permissions and preserves existing values on blank edits", () => {
    const created = ApiIdentity.provision({
      id: "api_identity_2",
      name: " Release Bot ",
      now: "2024-01-01T00:00:00.000Z",
    }).toDTO();
    const updated = ApiIdentity.rehydrate(created)
      .updateDetails({
        description: "   ",
        name: "   ",
        now: "2024-01-02T00:00:00.000Z",
      })
      .toDTO();

    expect(created.permissions).toEqual(createFullAccessPolicy("viewer"));
    expect(created.description).toBe("Release Bot automation identity.");
    expect(updated.name).toBe("Release Bot");
    expect(updated.description).toBe("Release Bot automation identity.");
    expect(() =>
      ApiIdentity.provision({
        id: "api_identity_3",
        name: "   ",
        now: "2024-01-01T00:00:00.000Z",
      }),
    ).toThrow("Name is required.");
  });
});
