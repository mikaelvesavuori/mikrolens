describe("app state", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("restores valid persisted UI preferences and applies the saved theme", async () => {
    const browser = createBrowserEnvironment({
      "mikrolens-ui-state": JSON.stringify({
        activeArea: "Plan",
        activeSpaceId: "space_platform",
        activeViewId: "view_focus",
        planDisplay: "timeline",
        planTimelineSort: "space",
        settingsSubview: "users",
        theme: "dark",
        workSort: "title",
        workView: "list-workflow",
      }),
    });
    const stateModule = await import("../../../app/state/state.js");

    stateModule.restoreUiState();

    expect(stateModule.state.activeArea).toBe("Plan");
    expect(stateModule.state.activeSpaceId).toBe("space_platform");
    expect(stateModule.state.activeViewId).toBe("view_focus");
    expect(stateModule.state.planDisplay).toBe("timeline");
    expect(stateModule.state.planTimelineSort).toBe("space");
    expect(stateModule.state.settingsSubview).toBe("users");
    expect(stateModule.state.theme).toBe("dark");
    expect(stateModule.state.workSort).toBe("title");
    expect(stateModule.state.workView).toBe("list-workflow");
    expect(browser.document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignores malformed or unsupported persisted values", async () => {
    const browser = createBrowserEnvironment({
      "mikrolens-ui-state": JSON.stringify({
        activeArea: "Not an area",
        activeSpaceId: 42,
        planDisplay: "gallery",
        planTimelineSort: "swimlane",
        settingsSubview: "danger-zone",
        theme: "midnight",
        workSort: "priority",
        workView: "timeline",
      }),
    });
    const stateModule = await import("../../../app/state/state.js");

    stateModule.restoreUiState();

    expect(stateModule.state.activeArea).toBe("Understand");
    expect(stateModule.state.activeSpaceId).toBe("");
    expect(stateModule.state.planDisplay).toBe("board");
    expect(stateModule.state.planTimelineSort).toBe("date");
    expect(stateModule.state.settingsSubview).toBe("spaces");
    expect(stateModule.state.theme).toBe("light");
    expect(stateModule.state.workSort).toBe("updated-desc");
    expect(stateModule.state.workView).toBe("board");
    expect(browser.document.documentElement.dataset.theme).toBe("light");
  });

  it("persists the shareable UI preferences and builds API URLs from config or origin", async () => {
    const browser = createBrowserEnvironment();
    const stateModule = await import("../../../app/state/state.js");
    const apiModule = await import("../../../app/core/api.js");

    stateModule.state.activeArea = "Work";
    stateModule.state.activeSpaceId = "space_platform";
    stateModule.state.activeViewId = "view_work";
    stateModule.state.planDisplay = "list";
    stateModule.state.planTimelineSort = "horizon";
    stateModule.state.settingsSubview = "webhooks";
    stateModule.state.theme = "dark";
    stateModule.state.workView = "list-evolution";
    stateModule.state.workSort = "title";
    stateModule.state.selectedWorkItemId = "work_item_ignored";

    stateModule.persistUiState();

    expect(JSON.parse(browser.storage.get("mikrolens-ui-state") ?? "{}")).toEqual({
      activeArea: "Work",
      activeSpaceId: "space_platform",
      activeViewId: "view_work",
      planDisplay: "list",
      planTimelineSort: "horizon",
      settingsSubview: "webhooks",
      theme: "dark",
      workSort: "title",
      workView: "list-evolution",
    });

    expect(apiModule.buildApiUrl("/api/bootstrap")).toBe("http://localhost:3000/api/bootstrap");

    stateModule.state.config = {
      api: {
        baseUrl: "https://api.example.com",
      },
    };

    expect(apiModule.buildApiUrl("/auth/session")).toBe("https://api.example.com/auth/session");
  });
});

function createBrowserEnvironment(initialStorage: Record<string, string> = {}) {
  const storage = new Map(Object.entries(initialStorage));
  const document = {
    documentElement: {
      dataset: {} as Record<string, string>,
    },
    getElementById: () => null,
    title: "MikroLens",
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("localStorage", {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
  }));
  vi.stubGlobal("window", {
    location: {
      origin: "http://localhost:3000",
    },
  });

  return {
    document,
    storage,
  };
}
