describe("render settings horizons", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("renders the dedicated Horizons settings surface with one shared defaults action", async () => {
    createBrowserEnvironment();
    const stateModule = await import("../../../app/state/state.js");
    const { renderSettingsView, renderSettingsModal } = await import(
      "../../../app/ui/renderSettings.js"
    );

    stateModule.state.settingsSubview = "horizons";
    stateModule.state.snapshot = createSnapshot();
    stateModule.state.settingsModal = {
      kind: "org-horizons-edit",
    };

    const viewHtml = renderSettingsView();
    const modalHtml = renderSettingsModal();

    expect(viewHtml).toContain('data-settings-subview="horizons"');
    expect(viewHtml).toContain("Shared Horizon defaults");
    expect(viewHtml).toContain("1 space override");
    expect((viewHtml.match(/Override/g) ?? []).length).toBe(1);
    expect((viewHtml.match(/Default/g) ?? []).length).toBe(5);
    expect((viewHtml.match(/Edit defaults/g) ?? []).length).toBe(1);
    expect(viewHtml).toContain("Edit Space's horizons");
    expect(modalHtml).toContain("Organization defaults");
    expect((modalHtml.match(/Edit default/g) ?? []).length).toBe(3);
    expect(modalHtml).toContain("Likely next work once ready enough to pull.");
  });
});

function createSnapshot() {
  const timestamp = "2026-04-03T10:00:00.000Z";

  return {
    apiIdentities: [],
    horizonDefaults: [
      {
        createdAt: timestamp,
        description: "Immediate work and current planning focus.",
        key: "horizon_1",
        label: "Now",
        orderIndex: 0,
        timeframeText: "Current work and near-term pull decisions.",
        updatedAt: timestamp,
      },
      {
        createdAt: timestamp,
        description: "Upcoming work that should stay visible but is not active yet.",
        key: "horizon_2",
        label: "Next",
        orderIndex: 1,
        timeframeText: "Likely next work once ready enough to pull.",
        updatedAt: timestamp,
      },
      {
        createdAt: timestamp,
        description: "Longer-range ideas and commitments that are not ready to pull forward.",
        key: "horizon_3",
        label: "Later",
        orderIndex: 2,
        timeframeText: "Longer-horizon bets and preserved candidates.",
        updatedAt: timestamp,
      },
    ],
    horizons: [
      {
        createdAt: timestamp,
        description: "Immediate work and current planning focus.",
        descriptionOverride: "Immediate work and current planning focus.",
        id: "horizon_product_1",
        inheritsDefault: false,
        key: "horizon_1",
        label: "Now",
        labelOverride: "Now",
        name: "Now",
        orderIndex: 0,
        spaceId: "space_product",
        timeframeText: "Current work and near-term pull decisions.",
        timeframeTextOverride: "Current work and near-term pull decisions.",
        updatedAt: timestamp,
      },
      {
        createdAt: timestamp,
        description: "Upcoming work for Product once designs and scope are ready.",
        descriptionOverride: "Upcoming work for Product once designs and scope are ready.",
        id: "horizon_product_2",
        inheritsDefault: false,
        key: "horizon_2",
        label: "Soon",
        labelOverride: "Soon",
        name: "Soon",
        orderIndex: 1,
        spaceId: "space_product",
        timeframeText: "Queued for the next planning cycle.",
        timeframeTextOverride: "Queued for the next planning cycle.",
        updatedAt: timestamp,
      },
      {
        createdAt: timestamp,
        description: "Longer-range ideas and commitments that are not ready to pull forward.",
        descriptionOverride: null,
        id: "horizon_product_3",
        inheritsDefault: true,
        key: "horizon_3",
        label: "Later",
        labelOverride: null,
        name: "Later",
        orderIndex: 2,
        spaceId: "space_product",
        timeframeText: "Longer-horizon bets and preserved candidates.",
        timeframeTextOverride: null,
        updatedAt: timestamp,
      },
    ],
    meta: {},
    spaces: [
      {
        accent: "#315ff4",
        createdAt: timestamp,
        description: "Product surface work and roadmap shaping.",
        id: "space_product",
        name: "Product Experience",
        updatedAt: timestamp,
      },
    ],
    users: [],
    webhooks: [],
  };
}

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
