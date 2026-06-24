import { buildAppUrl, parseAppUrl } from "../../../app/routing/routes.js";

describe("app routes", () => {
  it("parses settings and record deep links", () => {
    expect(parseAppUrl("http://localhost/settings/users?spaceId=space_product")).toEqual({
      activeArea: "Settings",
      activeSpaceId: "space_product",
      activeViewId: "",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "",
      selectedDocumentId: "",
      selectedSignalKey: "",
      selectedWorkItemKey: "",
      settingsSubview: "users",
      workSort: null,
      workView: null,
    });

    expect(parseAppUrl("http://localhost/settings/horizons")).toEqual({
      activeArea: "Settings",
      activeSpaceId: null,
      activeViewId: "",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "",
      selectedDocumentId: "",
      selectedSignalKey: "",
      selectedWorkItemKey: "",
      settingsSubview: "horizons",
      workSort: null,
      workView: null,
    });

    expect(parseAppUrl("http://localhost/work-items/ML-33")).toEqual({
      activeArea: "Work",
      activeSpaceId: null,
      activeViewId: "",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "",
      selectedDocumentId: "",
      selectedSignalKey: "",
      selectedWorkItemKey: "ML-33",
      settingsSubview: null,
      workSort: null,
      workView: null,
    });

    expect(parseAppUrl("http://localhost/work-items/work_item_123")).toEqual({
      activeArea: "Work",
      activeSpaceId: null,
      activeViewId: "",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "",
      selectedDocumentId: "",
      selectedSignalKey: "",
      selectedWorkItemKey: "work_item_123",
      settingsSubview: null,
      workSort: null,
      workView: null,
    });

    expect(parseAppUrl("http://localhost/intake")).toEqual({
      activeArea: "Intake",
      activeSpaceId: null,
      activeViewId: "",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "",
      selectedDocumentId: "",
      selectedSignalKey: "",
      selectedWorkItemKey: "",
      settingsSubview: null,
      workSort: null,
      workView: null,
    });

    expect(parseAppUrl("http://localhost/unknown").activeArea).toBe("Understand");

    expect(parseAppUrl("http://localhost/signals/SIG-123")).toEqual({
      activeArea: "Intake",
      activeSpaceId: null,
      activeViewId: "",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "",
      selectedDocumentId: "",
      selectedSignalKey: "SIG-123",
      selectedWorkItemKey: "",
      settingsSubview: null,
      workSort: null,
      workView: null,
    });

    expect(parseAppUrl("http://localhost/settings/unknown")).toEqual({
      activeArea: "Settings",
      activeSpaceId: null,
      activeViewId: "",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "",
      selectedDocumentId: "",
      selectedSignalKey: "",
      selectedWorkItemKey: "",
      settingsSubview: "spaces",
      workSort: null,
      workView: null,
    });

    expect(
      parseAppUrl(
        "http://localhost/work?spaceId=space_platform&search=blocked&viewId=view_triage&workSort=state&workView=list-workflow",
      ),
    ).toEqual({
      activeArea: "Work",
      activeSpaceId: "space_platform",
      activeViewId: "view_triage",
      directSearch: "",
      directType: "",
      hasExplicitPath: true,
      planDisplay: null,
      planTimelineSort: null,
      search: "blocked",
      selectedDocumentId: "",
      selectedSignalKey: "",
      selectedWorkItemKey: "",
      settingsSubview: null,
      workSort: "state",
      workView: "list-workflow",
    });
  });

  it("builds canonical URLs from UI state", () => {
    expect(
      buildAppUrl(
        {
          activeArea: "Settings",
          activeSpaceId: "space_platform",
          activeViewId: "",
          directSearch: "",
          directType: "",
          planDisplay: "board",
          planTimelineSort: "date",
          search: "",
          selectedDocumentId: "",
          selectedSignalId: "",
          selectedSignalRouteKey: "",
          selectedWorkItemId: "",
          selectedWorkItemRouteKey: "",
          settingsSubview: "api-identities",
          workSort: "updated-desc",
          workView: "board",
        },
        "http://localhost/",
      ),
    ).toBe("/settings/api-identities?spaceId=space_platform");

    expect(
      buildAppUrl(
        {
          activeArea: "Settings",
          activeSpaceId: "",
          activeViewId: "",
          directSearch: "",
          directType: "",
          planDisplay: "board",
          planTimelineSort: "date",
          search: "",
          selectedDocumentId: "",
          selectedSignalId: "",
          selectedSignalRouteKey: "",
          selectedWorkItemId: "",
          selectedWorkItemRouteKey: "",
          settingsSubview: "horizons",
          workSort: "updated-desc",
          workView: "board",
        },
        "http://localhost/",
      ),
    ).toBe("/settings/horizons");

    expect(
      buildAppUrl(
        {
          activeArea: "Plan",
          activeSpaceId: "",
          activeViewId: "",
          directSearch: "",
          directType: "",
          planDisplay: "board",
          planTimelineSort: "date",
          search: "",
          selectedDocumentId: "doc_456",
          selectedSignalId: "",
          selectedSignalRouteKey: "",
          selectedWorkItemId: "",
          selectedWorkItemRouteKey: "",
          settingsSubview: "spaces",
          workSort: "updated-desc",
          workView: "board",
        },
        "http://localhost/",
      ),
    ).toBe("/documents/doc_456");

    expect(
      buildAppUrl(
        {
          activeArea: "Intake",
          activeSpaceId: "space_platform",
          activeViewId: "",
          directSearch: "",
          directType: "",
          planDisplay: "board",
          planTimelineSort: "date",
          search: "",
          selectedDocumentId: "",
          selectedSignalId: "",
          selectedSignalRouteKey: "",
          selectedWorkItemId: "",
          selectedWorkItemRouteKey: "",
          settingsSubview: "spaces",
          workSort: "updated-desc",
          workView: "board",
        },
        "http://localhost/",
      ),
    ).toBe("/intake");

    expect(
      buildAppUrl(
        {
          activeArea: "Work",
          activeSpaceId: "",
          activeViewId: "",
          directSearch: "",
          directType: "",
          planDisplay: "board",
          planTimelineSort: "date",
          search: "",
          selectedDocumentId: "",
          selectedSignalId: "",
          selectedSignalRouteKey: "",
          selectedWorkItemId: "d5Y1uH9n",
          selectedWorkItemRouteKey: "ML-33",
          settingsSubview: "spaces",
          workSort: "updated-desc",
          workView: "board",
        },
        "http://localhost/",
      ),
    ).toBe("/work-items/ML-33");

    expect(
      buildAppUrl(
        {
          activeArea: "Intake",
          activeSpaceId: "",
          activeViewId: "",
          directSearch: "",
          directType: "",
          planDisplay: "board",
          planTimelineSort: "date",
          search: "",
          selectedDocumentId: "",
          selectedSignalId: "signal_123",
          selectedSignalRouteKey: "",
          selectedWorkItemId: "",
          selectedWorkItemRouteKey: "",
          settingsSubview: "spaces",
          workSort: "updated-desc",
          workView: "board",
          snapshot: {
            signals: [{ id: "signal_123", ref: "SIG-123" }],
            workItems: [],
          },
        },
        "http://localhost/",
      ),
    ).toBe("/signals/SIG-123");

    expect(
      buildAppUrl(
        {
          activeArea: "Work",
          activeSpaceId: "space_platform",
          activeViewId: "view_triage",
          directSearch: "",
          directType: "",
          planDisplay: "board",
          planTimelineSort: "date",
          search: "blocked",
          selectedDocumentId: "",
          selectedSignalId: "",
          selectedSignalRouteKey: "",
          selectedWorkItemId: "",
          selectedWorkItemRouteKey: "",
          settingsSubview: "spaces",
          workSort: "state",
          workView: "list-workflow",
        },
        "http://localhost/",
      ),
    ).toBe(
      "/work?spaceId=space_platform&viewId=view_triage&search=blocked&workSort=state&workView=list-workflow",
    );
  });
});
