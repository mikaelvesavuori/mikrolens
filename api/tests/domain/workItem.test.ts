import { WorkItem, type WorkItemDTO } from "../../src/domain/WorkItem.ts";

describe("WorkItem", () => {
  it("creates a valid dto with defaults and derived fields", () => {
    const dto = WorkItem.create({
      horizonId: "horizon_now",
      id: "work_item_1",
      now: "2024-01-01T00:00:00.000Z",
      ownerName: "  Mikael  ",
      ownerUserIds: ["user_mikael", "user_lea"],
      ref: "ML-1",
      spaceId: "space_platform",
      title: "  Explore stronger modeling  ",
      type: "Change",
    }).toDTO();

    expect(dto).toMatchObject({
      blockedReason: "",
      completedAt: null,
      horizonId: "horizon_now",
      id: "work_item_1",
      ownerName: "Mikael",
      ownerUserIds: ["user_mikael", "user_lea"],
      ref: "ML-1",
      roadmapRelevance: true,
      source: "planned",
      spaceId: "space_platform",
      state: "Inbox",
      targetEndDate: null,
      targetStartDate: null,
      title: "Explore stronger modeling",
      type: "Change",
    });
    expect(dto.summary).toBe("");
  });

  it("applies operational updates with domain-owned transition rules", () => {
    const existing: WorkItemDTO = {
      blockedReason: "Waiting for a final sign-off.",
      completedAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      horizonId: "horizon_now",
      id: "work_item_1",
      lastTouchedAt: "2024-01-01T00:00:00.000Z",
      ownerName: null,
      ownerUserIds: [],
      ref: "ML-1",
      roadmapRelevance: true,
      source: "planned",
      spaceId: "space_platform",
      state: "Blocked",
      summary: "Initial summary",
      targetEndDate: null,
      targetStartDate: null,
      title: "Initial title",
      type: "Problem",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const updated = WorkItem.rehydrate(existing)
      .applyOperationalUpdate({
        now: "2024-01-02T00:00:00.000Z",
        ownerName: "  Mikael  ",
        ownerUserIds: ["user_mikael"],
        state: "Active",
        targetEndDate: "2024-01-09",
        targetStartDate: "2024-01-04",
        title: "  Refined title  ",
        type: "Task",
      })
      .toDTO();

    expect(updated.blockedReason).toBe("");
    expect(updated.ownerName).toBe("Mikael");
    expect(updated.ownerUserIds).toEqual(["user_mikael"]);
    expect(updated.roadmapRelevance).toBe(false);
    expect(updated.state).toBe("Active");
    expect(updated.targetEndDate).toBe("2024-01-09");
    expect(updated.targetStartDate).toBe("2024-01-04");
    expect(updated.title).toBe("Refined title");
    expect(updated.completedAt).toBeNull();
  });

  it("tracks completion timestamps when work moves in and out of Done", () => {
    const base: WorkItemDTO = {
      blockedReason: "",
      completedAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      horizonId: "horizon_now",
      id: "work_item_1",
      lastTouchedAt: "2024-01-01T00:00:00.000Z",
      ownerName: null,
      ownerUserIds: [],
      ref: "ML-1",
      roadmapRelevance: false,
      source: "planned",
      spaceId: "space_platform",
      state: "Inbox",
      summary: "Initial summary",
      targetEndDate: null,
      targetStartDate: null,
      title: "Initial title",
      type: "Task",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const completed = WorkItem.rehydrate(base)
      .applyOperationalUpdate({
        now: "2024-01-03T00:00:00.000Z",
        state: "Done",
      })
      .toDTO();
    const reopened = WorkItem.rehydrate(completed)
      .applyOperationalUpdate({
        now: "2024-01-04T00:00:00.000Z",
        state: "Active",
      })
      .toDTO();

    expect(completed.completedAt).toBe("2024-01-03T00:00:00.000Z");
    expect(reopened.completedAt).toBeNull();
  });

  it("rejects target windows where the end date is before the start date", () => {
    expect(() =>
      WorkItem.create({
        horizonId: "horizon_now",
        id: "work_item_2",
        now: "2024-01-01T00:00:00.000Z",
        ref: "ML-2",
        spaceId: "space_platform",
        targetEndDate: "2024-01-03",
        targetStartDate: "2024-01-04",
        title: "Impossible target window",
      }),
    ).toThrow("Target end date must be on or after target start date.");
  });

  it("lets work become blocked, preserves completion when state does not change, and clears dates explicitly", () => {
    const created = WorkItem.create({
      horizonId: "horizon_now",
      id: "work_item_3",
      now: "2024-01-01T00:00:00.000Z",
      ref: "ML-3",
      spaceId: "space_platform",
      title: "Review the next planning pass",
      type: "Task",
    }).toDTO();
    const blocked = WorkItem.rehydrate(created)
      .applyOperationalUpdate({
        blockedReason: "Waiting for a dependency decision.",
        now: "2024-01-02T00:00:00.000Z",
        state: "Blocked",
      })
      .toDTO();
    const completed = WorkItem.rehydrate(blocked)
      .applyOperationalUpdate({
        now: "2024-01-03T00:00:00.000Z",
        state: "Done",
        targetEndDate: "2024-01-10",
        targetStartDate: "2024-01-05",
      })
      .toDTO();
    const updatedWithoutStateChange = WorkItem.rehydrate(completed)
      .applyOperationalUpdate({
        now: "2024-01-04T00:00:00.000Z",
        targetEndDate: "",
        targetStartDate: "",
        title: "Review the refined planning pass",
      })
      .toDTO();

    expect(blocked.blockedReason).toBe("Waiting for a dependency decision.");
    expect(completed.completedAt).toBe("2024-01-03T00:00:00.000Z");
    expect(updatedWithoutStateChange.completedAt).toBe("2024-01-03T00:00:00.000Z");
    expect(updatedWithoutStateChange.targetStartDate).toBeNull();
    expect(updatedWithoutStateChange.targetEndDate).toBeNull();
    expect(updatedWithoutStateChange.title).toBe("Review the refined planning pass");
  });

  it("rejects malformed or impossible target dates", () => {
    expect(() =>
      WorkItem.create({
        horizonId: "horizon_now",
        id: "work_item_4",
        now: "2024-01-01T00:00:00.000Z",
        ref: "ML-4",
        spaceId: "space_platform",
        targetStartDate: "2024/01/04",
        title: "Malformed target date",
      }),
    ).toThrow("Target dates must use YYYY-MM-DD.");
    expect(() =>
      WorkItem.create({
        horizonId: "horizon_now",
        id: "work_item_5",
        now: "2024-01-01T00:00:00.000Z",
        ref: "ML-5",
        spaceId: "space_platform",
        targetStartDate: "2024-02-31",
        title: "Impossible target date",
      }),
    ).toThrow("Target dates must be valid calendar dates.");
  });
});
