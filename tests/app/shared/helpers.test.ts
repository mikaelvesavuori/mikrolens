describe("document space labels", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("prefers linked work spaces over the standalone fallback", async () => {
    createBrowserEnvironment();
    const { getDocumentSpaceLabels } = await import("../../../app/shared/helpers.js");

    const labels = getDocumentSpaceLabels(
      {
        id: "document_global",
        spaceName: null,
      },
      [
        {
          linkedDocuments: [{ id: "document_global" }, { id: "document_other" }],
          space: {
            id: "space_platform",
            name: "Platform",
          },
        },
        {
          linkedDocuments: [{ id: "document_global" }],
          space: {
            id: "space_iam",
            name: "IAM",
          },
        },
      ],
    );

    expect(labels).toEqual(["IAM", "Platform"]);
  });

  it("keeps standalone when a document has no linked work spaces", async () => {
    createBrowserEnvironment();
    const { getDocumentSpaceLabels } = await import("../../../app/shared/helpers.js");

    expect(
      getDocumentSpaceLabels(
        {
          id: "document_global",
          spaceName: null,
        },
        [],
      ),
    ).toEqual(["Standalone"]);
  });
});

function createBrowserEnvironment() {
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
      origin: "http://localhost:4321",
    },
  });
}
