vi.mock("../../../app/ui/render.js", () => ({
  render: vi.fn(),
  renderNotifications: vi.fn(),
}));

describe("notifications", () => {
  afterEach(async () => {
    const { state } = await import("../../../app/state/state.js");

    state.notifications = [];
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("re-renders only the toast region when notifications change", async () => {
    createBrowserEnvironment();
    const renderModule = await import("../../../app/ui/render.js");
    const { dismissNotification, showSuccess } = await import("../../../app/ui/notifications.js");

    const notificationId = showSuccess("Saved.", { duration: 0 });
    dismissNotification(notificationId);

    expect(renderModule.renderNotifications).toHaveBeenCalledTimes(2);
    expect(renderModule.render).not.toHaveBeenCalled();
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
    clearTimeout,
    location: {
      origin: "http://localhost:4321",
    },
    setTimeout,
  });
}
