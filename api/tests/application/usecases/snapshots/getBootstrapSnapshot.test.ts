import { getBootstrapSnapshot } from "../../../../src/application/usecases/snapshots/getBootstrapSnapshot.ts";
import { createTestRepository } from "../../../support/testUtils.ts";

describe("getBootstrapSnapshot", () => {
  it("includes standalone documents when scoped to a space", () => {
    const { database, repository } = createTestRepository();

    repository.saveDocument({
      createdAt: "2026-04-01T08:00:00.000Z",
      horizonId: null,
      id: "document_global_linkable",
      markdown: "# Global document",
      spaceId: null,
      summary: "Global document that can be linked from any space.",
      title: "Global linkable document",
      type: "Evolution",
      updatedAt: "2026-04-01T08:00:00.000Z",
    });

    const snapshot = getBootstrapSnapshot(repository, "space_platform");
    const titles = snapshot.documents.map((document) => document.title);

    expect(titles).toContain("Global linkable document");
    expect(titles).toContain("Q2 reliability focus");
    expect(titles).not.toContain("Machine token revocation");

    database.close();
  });

  it("derives a visible document summary from markdown when no explicit summary is set", () => {
    const { database, repository } = createTestRepository();

    repository.saveDocument({
      createdAt: "2026-04-01T08:00:00.000Z",
      horizonId: null,
      id: "document_blank_summary",
      markdown: "# Draft note\n\nThis summary should come from the first real paragraph.",
      spaceId: null,
      summary: "",
      title: "Draft note",
      type: "Note",
      updatedAt: "2026-04-01T08:00:00.000Z",
    });

    const snapshot = getBootstrapSnapshot(repository);
    const document = snapshot.documents.find((entry) => entry.id === "document_blank_summary");

    expect(document?.summary).toBe("This summary should come from the first real paragraph.");

    database.close();
  });

  it("orders workflow states so Parked sits beside Blocked and appears on the board", () => {
    const { database, repository } = createTestRepository();

    const snapshot = getBootstrapSnapshot(repository);

    expect(snapshot.meta.boardWorkflowStates).toEqual([
      "Inbox",
      "Shaping",
      "Ready",
      "Active",
      "Blocked",
      "Parked",
      "Waiting",
      "Done",
    ]);
    expect(snapshot.meta.workflowStates).toEqual([
      "Inbox",
      "Shaping",
      "Ready",
      "Active",
      "Blocked",
      "Parked",
      "Waiting",
      "Done",
      "Archived",
    ]);

    database.close();
  });
});
