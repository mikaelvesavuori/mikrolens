describe("render plan timeline", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("renders roadmap work on a shared gantt timeline while keeping horizon as metadata", async () => {
    createBrowserEnvironment();
    const stateModule = await import("../../../app/state/state.js");
    const { renderPlanView } = await import("../../../app/ui/renderPlan.js");

    stateModule.state.planDisplay = "timeline";
    stateModule.state.planTimelineSort = "date";
    stateModule.state.snapshot = {
      documents: [
        {
          horizonName: "Later",
          id: "document_platform_uplift",
          spaceId: "space_platform",
          spaceName: "Platform",
          summary: "Platform evolution without committed dates yet.",
          title: "Platform uplift",
          type: "Evolution",
        },
      ],
      plan: {
        computed: [],
        horizons: ["Now", "Next", "Later"],
      },
      workItems: [
        {
          horizon: {
            id: "horizon_iam_next",
            label: "Next",
            name: "Next",
          },
          id: "work_export_retries",
          linkedDocuments: [
            {
              horizonName: "Next",
              id: "document_iam_hardening",
              spaceId: "space_iam",
              spaceName: "IAM",
              summary: "IAM hardening evolution.",
              title: "IAM hardening",
              type: "Evolution",
            },
          ],
          ref: "ML-18",
          roadmapRelevance: true,
          space: {
            id: "space_iam",
            name: "IAM",
          },
          state: "Ready",
          summary: "Large-tenant export retries need scheduling.",
          targetEndDate: "2026-05-10",
          targetStartDate: "2026-04-01",
          title: "Schedule export retries",
        },
        {
          horizon: {
            id: "horizon_platform_later",
            label: "Later",
            name: "Later",
          },
          id: "work_rotation_cleanup",
          linkedDocuments: [],
          ref: "ML-44",
          roadmapRelevance: true,
          space: {
            id: "space_platform",
            name: "Platform",
          },
          state: "Inbox",
          summary: "Queue follow-up cleanup once ownership is clear.",
          targetEndDate: null,
          targetStartDate: null,
          title: "Queue token rotation cleanup",
        },
      ],
    };

    const html = renderPlanView();

    expect(html).toContain('data-plan-display="timeline"');
    expect(html).toContain('data-plan-timeline-sort="date"');
    expect(html).toContain('data-plan-timeline-sort="space"');
    expect(html).toContain('data-plan-timeline-sort="horizon"');
    expect(html).toContain('class="plan-gantt"');
    expect(html).toContain('data-timeline-month="2026-04"');
    expect(html).toContain('data-timeline-month="2026-05"');
    expect(html).toContain('class="plan-gantt-bar"');
    expect(html).toContain("scheduled");
    expect(html).toContain("without dates");
    expect(html).toContain("Schedule export retries");
    expect(html).toContain("Queue token rotation cleanup");
    expect(html).toContain("No target dates");
    expect(html).toContain("Platform uplift");
    expect((html.match(/IAM hardening/g) ?? []).length).toBe(1);
  });

  it("can order gantt rows by space", async () => {
    createBrowserEnvironment();
    const stateModule = await import("../../../app/state/state.js");
    const { renderPlanView } = await import("../../../app/ui/renderPlan.js");

    stateModule.state.planDisplay = "timeline";
    stateModule.state.planTimelineSort = "space";
    stateModule.state.snapshot = {
      documents: [],
      plan: {
        computed: [],
        horizons: ["Now", "Next", "Later"],
      },
      workItems: [
        {
          horizon: {
            id: "horizon_zeta_next",
            label: "Next",
            name: "Next",
          },
          id: "work_zeta",
          linkedDocuments: [],
          ref: "ML-50",
          roadmapRelevance: true,
          space: {
            id: "space_zeta",
            name: "Zeta",
          },
          state: "Ready",
          summary: "Zeta work lands sooner.",
          targetEndDate: "2026-04-10",
          targetStartDate: "2026-04-01",
          title: "Zeta rollout",
        },
        {
          horizon: {
            id: "horizon_alpha_later",
            label: "Later",
            name: "Later",
          },
          id: "work_alpha",
          linkedDocuments: [],
          ref: "ML-51",
          roadmapRelevance: true,
          space: {
            id: "space_alpha",
            name: "Alpha",
          },
          state: "Inbox",
          summary: "Alpha work lands later.",
          targetEndDate: "2026-06-10",
          targetStartDate: "2026-06-01",
          title: "Alpha rollout",
        },
      ],
    };

    const html = renderPlanView();

    expect(html.indexOf("Alpha rollout")).toBeLessThan(html.indexOf("Zeta rollout"));
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
