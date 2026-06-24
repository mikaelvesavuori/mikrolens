import { afterEach, beforeEach, vi } from "vitest";
import { getUnderstandSnapshot } from "../../../../src/application/usecases/snapshots/getUnderstandSnapshot.ts";
import { createTestRepository } from "../../../support/testUtils.ts";

describe("getUnderstandSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces intake debt, blocked work, and stale items from the ledger", () => {
    const { database, repository } = createTestRepository();

    const snapshot = getUnderstandSnapshot(repository);
    const needsOwner = snapshot.metrics.find((metric) => metric.label === "Needs owner");
    const inboxDebt = snapshot.metrics.find((metric) => metric.label === "Inbox debt");
    const blockedNow = snapshot.metrics.find((metric) => metric.label === "Blocked now");
    const staleItems = snapshot.metrics.find((metric) => metric.label === "Stale items");
    const pastTarget = snapshot.metrics.find((metric) => metric.label === "Past target");
    const unplannedOpen = snapshot.metrics.find((metric) => metric.label === "Unplanned open");

    expect(snapshot.counts).toEqual({
      blocked: 2,
      inboxDebt: 2,
      needsOwner: 3,
      pastTarget: 3,
      stale: 5,
      unplannedOpen: 4,
    });
    expect(inboxDebt?.value).toBe("2");
    expect(blockedNow?.value).toBe("2");
    expect(needsOwner?.value).toBe("3");
    expect(staleItems?.value).toBe("5");
    expect(pastTarget?.value).toBe("3");
    expect(unplannedOpen?.value).toBe("4");
    expect(snapshot.blockedItems.map((item) => item.ref)).toEqual(
      expect.arrayContaining(["ML-18", "ML-42"]),
    );
    expect(snapshot.pastTargetItems.map((item) => item.ref)).toEqual(
      expect.arrayContaining(["ML-18", "ML-42"]),
    );
    expect(snapshot.staleItems.map((item) => item.ref)).toEqual(
      expect.arrayContaining(["ML-18", "ML-40"]),
    );

    database.close();
  });

  it("keeps headline counts truthful even when pressure previews are capped", () => {
    const { database, repository } = createTestRepository();
    const template = repository.listWorkItems().find((item) => item.state === "Blocked");

    if (!template) {
      throw new Error("Expected seeded blocked work item.");
    }

    for (let index = 0; index < 5; index += 1) {
      repository.saveWorkItem({
        ...template,
        id: `blocked_test_${index}`,
        ref: `ML-90${index}`,
        title: `Blocked test ${index}`,
        updatedAt: `2026-03-${String(15 + index).padStart(2, "0")}T12:00:00.000Z`,
      });
    }

    const snapshot = getUnderstandSnapshot(repository);
    const blockedNow = snapshot.metrics.find((metric) => metric.label === "Blocked now");

    expect(snapshot.counts.blocked).toBe(7);
    expect(snapshot.blockedItems).toHaveLength(6);
    expect(blockedNow?.value).toBe("7");

    database.close();
  });

  it("can focus the understanding view down to a single space", () => {
    const { database, repository } = createTestRepository();

    const snapshot = getUnderstandSnapshot(repository, "space_iam");

    expect(snapshot.blockedItems.every((item) => item.space.id === "space_iam")).toBe(true);
    expect(
      snapshot.recentChanges.every((entry) => {
        const ref = String(entry.metadata.ref ?? "");
        return !ref || ["ML-18", "ML-29", "ML-43"].includes(ref);
      }),
    ).toBe(true);

    database.close();
  });
});
