import {
  formatDocumentLinkLabel,
  getDocumentLinkCandidates,
} from "../../../app/documents/documentLinkOptions.js";

describe("document link options", () => {
  it("prefers the full document list so cross-space options stay linkable", () => {
    const linkedDocumentIds = new Set(["document_visible"]);

    const candidates = getDocumentLinkCandidates({
      allDocuments: [
        { id: "document_visible", title: "Visible doc" },
        { id: "document_global", title: "Global doc" },
        { id: "document_other_space", title: "Other space doc" },
      ],
      linkedDocumentIds,
      visibleDocuments: [
        { id: "document_visible", title: "Visible doc" },
        { id: "document_global", title: "Global doc" },
      ],
    });

    expect(candidates.map((document) => document.id)).toEqual([
      "document_global",
      "document_other_space",
    ]);
  });

  it("falls back to the visible document list when the full list is unavailable", () => {
    const candidates = getDocumentLinkCandidates({
      linkedDocumentIds: new Set(["document_global"]),
      visibleDocuments: [
        { id: "document_global", title: "Global doc" },
        { id: "document_visible", title: "Visible doc" },
      ],
    });

    expect(candidates.map((document) => document.id)).toEqual(["document_visible"]);
  });

  it("renders link labels as just the document title", () => {
    expect(
      formatDocumentLinkLabel({
        spaceName: "IAM",
        title: "Access review",
        usedBy: "IAM",
      }),
    ).toBe("Access review");
  });
});
