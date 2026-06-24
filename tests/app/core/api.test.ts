describe("api helpers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("includes credentials for cross-origin API fetches and event streams", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    const eventSourceSpy = vi.fn();

    createBrowserEnvironment("https://app.example.com");
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("EventSource", function EventSourceMock(url: string, options?: EventSourceInit) {
      eventSourceSpy(url, options);
    });

    const stateModule = await import("../../../app/state/state.js");
    const apiModule = await import("../../../app/core/api.js");

    stateModule.state.config = {
      api: {
        baseUrl: "https://api.example.com",
      },
    };

    await apiModule.apiFetch("/auth/session");
    apiModule.createApiEventSource("/api/documents/doc_1/collaboration/stream");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/auth/session",
      expect.objectContaining({
        credentials: "include",
      }),
    );
    expect(eventSourceSpy).toHaveBeenCalledWith(
      "https://api.example.com/api/documents/doc_1/collaboration/stream",
      {
        withCredentials: true,
      },
    );
  });

  it("keeps same-origin credential mode when the API shares the frontend origin", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });

    createBrowserEnvironment("https://mikrolens.example.com");
    vi.stubGlobal("fetch", fetchSpy);

    const stateModule = await import("../../../app/state/state.js");
    const apiModule = await import("../../../app/core/api.js");

    stateModule.state.config = {
      api: {
        baseUrl: "https://mikrolens.example.com",
      },
    };

    await apiModule.apiFetch("/api/bootstrap");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://mikrolens.example.com/api/bootstrap",
      expect.objectContaining({
        credentials: "same-origin",
      }),
    );
  });

  it("keeps local API requests on the same loopback hostname as the frontend", async () => {
    createBrowserEnvironment("http://localhost:8000");

    const stateModule = await import("../../../app/state/state.js");
    const apiModule = await import("../../../app/core/api.js");

    stateModule.state.config = {
      api: {
        baseUrl: "http://127.0.0.1:3000",
      },
    };

    expect(apiModule.buildApiUrl("/auth/demo-login")).toBe("http://localhost:3000/auth/demo-login");
  });
});

function createBrowserEnvironment(origin: string) {
  vi.stubGlobal("document", {
    documentElement: {
      dataset: {} as Record<string, string>,
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
      origin,
    },
  });
}
