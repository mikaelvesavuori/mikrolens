describe("render signal intake", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("nudges respondents for customer and evidence context without adding fields", async () => {
    createBrowserEnvironment();
    const stateModule = await import("../../../app/state/state.js");
    const { renderSignalCaptureModal } = await import("../../../app/ui/render.js");

    stateModule.state.snapshot = {
      meta: {
        signalUrgencies: ["Low", "Medium", "High"],
      },
    };

    const html = renderSignalCaptureModal();

    expect(html).toContain("Context and evidence");
    expect(html).toContain("Who is affected?");
    expect(html).toContain("Where did the signal come from?");
    expect(html).toContain("What is the impact?");
    expect(html).toContain('name="summary"');
    expect(html).not.toContain('name="customer');
    expect(html).not.toContain('name="impact');
  });
});

function createBrowserEnvironment() {
  vi.stubGlobal("document", {
    body: {
      classList: {
        remove() {},
        toggle() {},
      },
    },
    documentElement: {
      dataset: {},
    },
    getElementById: () => null,
    title: "MikroLens",
  });
  vi.stubGlobal("HTMLElement", class HTMLElement {});
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
