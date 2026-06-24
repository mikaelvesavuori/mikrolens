import {
  buildDocumentUrl,
  buildViewUrl,
  buildWorkItemUrl,
  formatWorkItemForCopy,
} from "../../../app/shared/share.js";

describe("share helpers", () => {
  it("formats work items for copying", () => {
    expect(
      formatWorkItemForCopy({
        horizon: { name: "Next" },
        ref: "ML-123",
        state: "Ready",
        summary: "Clarify the migration plan before the next cycle.",
        title: "Shape storage migration",
      }),
    ).toBe(
      "ML-123 · Shape storage migration\n\nClarify the migration plan before the next cycle.\n\nState: Ready\nHorizon: Next",
    );
  });

  it("builds shareable view and record URLs", () => {
    const uiState = {
      activeArea: "Work",
      activeSpaceId: "space_platform",
      activeViewId: "view_blocked",
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
    };

    expect(buildViewUrl(uiState, "https://mikrolens.example/work")).toBe(
      "https://mikrolens.example/work?spaceId=space_platform&viewId=view_blocked&search=blocked&workSort=state&workView=list-workflow",
    );
    expect(buildDocumentUrl("document_123", uiState, "https://mikrolens.example/work")).toBe(
      "https://mikrolens.example/documents/document_123?spaceId=space_platform",
    );
    expect(
      buildWorkItemUrl(
        {
          id: "work_item_123",
          ref: "ML-123",
        },
        uiState,
        "https://mikrolens.example/work",
      ),
    ).toBe("https://mikrolens.example/work-items/ML-123?spaceId=space_platform");
  });
});
