describe("render work item modal", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("renders linked multi-owner controls with existing owner chips", async () => {
    createBrowserEnvironment();
    const stateModule = await import("../../../app/state/state.js");
    const { renderWorkItemModal } = await import("../../../app/ui/renderWork.js");

    stateModule.state.workItemDocsCollapsed = false;
    stateModule.state.snapshot = {
      documents: [],
      horizons: [
        {
          id: "horizon_product_1",
          key: "horizon_1",
          label: "Now",
          name: "Now",
          spaceId: "space_product",
        },
      ],
      meta: {
        workItemTypes: ["Task", "Change"],
        workflowStates: ["Inbox", "Ready", "Blocked", "Done"],
      },
      users: [
        {
          email: "amina@example.com",
          id: "user_amina",
          name: "Amina",
          permissions: {},
          role: "User",
          status: "Active",
        },
        {
          email: "mikael@example.com",
          id: "user_mikael",
          name: "Mikael",
          permissions: {},
          role: "Admin",
          status: "Active",
        },
        {
          email: "sara@example.com",
          id: "user_sara",
          name: "Sara",
          permissions: {},
          role: "User",
          status: "Active",
        },
      ],
    };
    stateModule.state.allDocuments = [];

    const html = renderWorkItemModal({
      blockedReason: "",
      createdAt: "2026-04-03T10:00:00.000Z",
      horizon: {
        id: "horizon_product_1",
        name: "Now",
      },
      horizonId: "horizon_product_1",
      id: "work_item_1",
      linkedDocuments: [],
      ownerName: "Mikael, Sara",
      owners: [
        {
          email: "mikael@example.com",
          id: "user_mikael",
          name: "Mikael",
        },
        {
          email: "sara@example.com",
          id: "user_sara",
          name: "Sara",
        },
      ],
      ref: "ML-46",
      space: {
        id: "space_product",
        name: "Product Experience",
      },
      spaceId: "space_product",
      state: "Ready",
      summary: "Make ownership explicit through linked users.",
      targetEndDate: null,
      targetStartDate: null,
      title: "Link multiple owners",
      type: "Task",
      updatedAt: "2026-04-03T11:00:00.000Z",
    });

    expect(html).toContain("Assigned owners");
    expect(html).toContain('data-action="add-work-item-owner"');
    expect(html).toContain('name="ownerUserIds"');
    expect(html).toContain("Remove Mikael");
    expect(html).toContain("Amina");
  });
});

function createBrowserEnvironment() {
  vi.stubGlobal("document", {
    documentElement: {
      dataset: {},
    },
    getElementById: () => null,
    title: "MikroLens",
  });
  vi.stubGlobal("localStorage", {
    getItem() {
      return null;
    },
    removeItem() {},
    setItem() {},
  });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
  }));
  vi.stubGlobal("window", {
    location: {
      origin: "http://localhost:4321",
    },
  });
}
