import { createDocument } from "../../../../src/application/usecases/documents/createDocument.ts";
import { deleteDocument } from "../../../../src/application/usecases/documents/deleteDocument.ts";
import { updateDocument } from "../../../../src/application/usecases/documents/updateDocument.ts";
import { updateHorizon } from "../../../../src/application/usecases/horizons/updateHorizon.ts";
import { createSignal } from "../../../../src/application/usecases/signals/createSignal.ts";
import { deleteSignal } from "../../../../src/application/usecases/signals/deleteSignal.ts";
import { pullSignalToSpace } from "../../../../src/application/usecases/signals/pullSignalToSpace.ts";
import { createSpace } from "../../../../src/application/usecases/spaces/createSpace.ts";
import { updateSpace } from "../../../../src/application/usecases/spaces/updateSpace.ts";
import { createWorkItem } from "../../../../src/application/usecases/workItems/createWorkItem.ts";
import { deleteWorkItem } from "../../../../src/application/usecases/workItems/deleteWorkItem.ts";
import { linkDocumentToWorkItem } from "../../../../src/application/usecases/workItems/linkDocumentToWorkItem.ts";
import { unlinkDocumentFromWorkItem } from "../../../../src/application/usecases/workItems/unlinkDocumentFromWorkItem.ts";
import { updateWorkItem } from "../../../../src/application/usecases/workItems/updateWorkItem.ts";
import { createTestRepository } from "../../../support/testUtils.ts";

describe("work item lifecycle", () => {
  it("creates a new work item with sane defaults", () => {
    const { database, repository } = createTestRepository();

    const workItem = createWorkItem(repository, {
      spaceId: "space_product",
      title: "Capture a roadmap sync follow-up",
      type: "Task",
    });

    expect(workItem.ref).toBe("ML-47");
    expect(workItem.state).toBe("Inbox");
    expect(workItem.horizon.name).toBe("Now");
    expect(workItem.space.name).toBe("Product Experience");

    database.close();
  });

  it("updates operational state without mutating the underlying model", () => {
    const { database, repository } = createTestRepository();
    const created = createWorkItem(repository, {
      spaceId: "space_product",
      title: "Investigate carry-over review language",
      type: "Problem",
    });

    const updated = updateWorkItem(repository, {
      blockedReason: "Waiting for one last review note from Storage.",
      id: created.id,
      ownerUserIds: ["user_mikael", "user_lea"],
      state: "Blocked",
    });

    expect(updated.state).toBe("Blocked");
    expect(updated.ownerName).toBe("Mikael, Lea");
    expect(updated.owners.map((owner) => owner.id)).toEqual(["user_mikael", "user_lea"]);
    expect(updated.isBlocked).toBe(true);

    database.close();
  });

  it("preserves existing linked owners when a patch does not include ownership changes", () => {
    const { database, repository } = createTestRepository();
    const existing = repository.getLedger().workItems.find((item) => item.ref === "ML-46");

    expect(existing?.ownerUserIds).toEqual(["user_mikael", "user_sara"]);

    const updated = updateWorkItem(repository, {
      id: existing?.id ?? "",
      summary: "Same ownership, tighter launch summary.",
    });

    expect(updated.ownerName).toBe("Mikael, Sara");
    expect(updated.owners.map((owner) => owner.id)).toEqual(["user_mikael", "user_sara"]);

    database.close();
  });

  it("creates shared signals in the Signals space", () => {
    const { database, repository } = createTestRepository();

    const signal = createSignal(repository, {
      source: "Mikael",
      summary: "Useful as a shared intake path for ideas that do not belong to a space yet.",
      title: "Add a Signal capability",
    });

    expect(signal.ref).toBe("SIG-1");
    expect(signal.source).toBe("Mikael");
    expect(signal.status).toBe("Open");
    expect(signal.urgency).toBe("Medium");

    database.close();
  });

  it("pulls a shared signal into another space and archives the intake copy", () => {
    const { database, repository } = createTestRepository();
    const signal = createSignal(repository, {
      expectedTimeline: "This quarter",
      source: "Lea",
      summary: "Let any teammate suggest work before a space owner pulls it forward.",
      title: "Shared signals",
      urgency: "High",
    });

    const pulled = pullSignalToSpace(repository, {
      signalId: signal.id,
      targetSpaceId: "space_platform",
    });
    const pulledSignal = repository.getSignal(signal.id);

    expect(pulled.space.id).toBe("space_platform");
    expect(pulled.type).toBe("Idea");
    expect(pulled.state).toBe("Inbox");
    expect(pulledSignal?.source).toBe("Lea");
    expect(pulledSignal?.urgency).toBe("High");
    expect(pulledSignal?.expectedTimeline).toBe("This quarter");
    expect(pulledSignal?.status).toBe("Pulled");
    expect(pulledSignal?.pulledIntoWorkItemId).toBe(pulled.id);

    database.close();
  });

  it("updates the work item type when it changes", () => {
    const { database, repository } = createTestRepository();
    const created = createWorkItem(repository, {
      spaceId: "space_product",
      title: "Tighten planning language",
      type: "Task",
    });

    const updated = updateWorkItem(repository, {
      id: created.id,
      type: "Change",
    });

    expect(updated.type).toBe("Change");
    expect(repository.getWorkItem(created.id)?.type).toBe("Change");

    database.close();
  });

  it("clears blocker notes once work is no longer blocked", () => {
    const { database, repository } = createTestRepository();
    const blocked = repository.getLedger().workItems.find((item) => item.ref === "ML-18");

    const updated = updateWorkItem(repository, {
      id: blocked?.id ?? "",
      state: "Active",
    });

    expect(updated.state).toBe("Active");
    expect(updated.blockedReason).toBe("");
    expect(updated.isBlocked).toBe(false);

    database.close();
  });

  it("links an existing document while leaving the work item intact", () => {
    const { database, repository } = createTestRepository();
    const created = createWorkItem(repository, {
      spaceId: "space_product",
      title: "Explore document linking language",
      type: "Problem",
    });
    const document = createDocument(repository, {
      title: "Existing evolution",
      type: "Evolution",
    });

    const updated = linkDocumentToWorkItem(repository, {
      documentId: document.id,
      workItemId: created.id,
    });
    const saved = repository.getLedger().workItems.find((item) => item.id === created.id);

    expect(document.type).toBe("Evolution");
    expect(document.title).toBe("Existing evolution");
    expect(saved?.type).toBe("Problem");
    expect(updated?.linkedDocuments.map((entry) => entry.id)).toContain(document.id);
    expect(
      repository.getLedger().documentLinks.some((link) => link.workItemId === created.id),
    ).toBe(true);

    database.close();
  });

  it("unlinks a document without removing either record", () => {
    const { database, repository } = createTestRepository();
    const created = createWorkItem(repository, {
      spaceId: "space_product",
      title: "Remove an obsolete linked document",
      type: "Task",
    });
    const document = createDocument(repository, {
      title: "Old implementation note",
      type: "Note",
    });

    linkDocumentToWorkItem(repository, {
      documentId: document.id,
      workItemId: created.id,
    });

    const updated = unlinkDocumentFromWorkItem(repository, {
      documentId: document.id,
      workItemId: created.id,
    });

    expect(updated?.linkedDocuments.map((entry) => entry.id)).not.toContain(document.id);
    expect(repository.getWorkItem(created.id)?.title).toBe("Remove an obsolete linked document");
    expect(repository.getDocument(document.id)?.title).toBe("Old implementation note");
    expect(
      repository
        .getLedger()
        .documentLinks.some(
          (link) => link.workItemId === created.id && link.documentId === document.id,
        ),
    ).toBe(false);

    database.close();
  });

  it("updates a document without breaking its linked context", () => {
    const { database, repository } = createTestRepository();
    const existing = repository.getLedger().documents[0];

    const updated = updateDocument(repository, {
      id: existing.id,
      markdown: "# Updated narrative\n\n- clearer summary",
      summary: "A sharper summary for the roadmap view.",
      title: "Updated narrative",
      type: "Strategy",
    });
    const saved = repository.getDocument(existing.id);

    expect(updated.title).toBe("Updated narrative");
    expect(updated.type).toBe("Strategy");
    expect(saved?.markdown).toContain("clearer summary");

    database.close();
  });

  it("deletes a work item and reopens any pulled signal that created it", () => {
    const { database, repository } = createTestRepository();
    const signal = createSignal(repository, {
      expectedTimeline: "This quarter",
      source: "Lea",
      summary: "Let intake survive if the pulled work item is later removed.",
      title: "Keep pulled signals reusable",
    });
    const pulled = pullSignalToSpace(repository, {
      signalId: signal.id,
      targetSpaceId: "space_product",
    });

    const deleted = deleteWorkItem(repository, pulled.id);
    const restoredSignal = repository.getSignal(signal.id);

    expect(deleted.id).toBe(pulled.id);
    expect(repository.getWorkItem(pulled.id)).toBeNull();
    expect(restoredSignal?.status).toBe("Open");
    expect(restoredSignal?.pulledIntoWorkItemId).toBeNull();
    expect(restoredSignal?.pulledAt).toBeNull();

    database.close();
  });

  it("deletes a signal without touching the pulled work item", () => {
    const { database, repository } = createTestRepository();
    const signal = createSignal(repository, {
      source: "Mikael",
      summary: "Delete the intake copy after the space has already adopted the work.",
      title: "Trim accepted signals",
    });
    const pulled = pullSignalToSpace(repository, {
      signalId: signal.id,
      targetSpaceId: "space_platform",
    });

    const deleted = deleteSignal(repository, signal.id);

    expect(deleted.id).toBe(signal.id);
    expect(repository.getSignal(signal.id)).toBeNull();
    expect(repository.getWorkItem(pulled.id)?.id).toBe(pulled.id);

    database.close();
  });

  it("deletes a document and removes its work links", () => {
    const { database, repository } = createTestRepository();
    const existing = repository.getLedger().documents[0];
    const linkedCountBefore = repository
      .getLedger()
      .documentLinks.filter((link) => link.documentId === existing.id).length;

    const deleted = deleteDocument(repository, existing.id);
    const linksAfterDelete = repository
      .getLedger()
      .documentLinks.filter((link) => link.documentId === existing.id);

    expect(deleted.id).toBe(existing.id);
    expect(linkedCountBefore).toBeGreaterThan(0);
    expect(repository.getDocument(existing.id)).toBeNull();
    expect(linksAfterDelete).toHaveLength(0);

    database.close();
  });

  it("creates a new space with the default horizons", () => {
    const { database, repository } = createTestRepository();

    const space = createSpace(repository, {
      accent: "#0f766e",
      description: "Shared platform work.",
      name: "Operations Core",
    });
    const horizons = repository
      .getLedger()
      .horizons.filter((horizon) => horizon.spaceId === space.id);

    expect(space.name).toBe("Operations Core");
    expect(horizons.map((horizon) => horizon.name)).toEqual(["Now", "Next", "Later"]);

    database.close();
  });

  it("updates space and horizon metadata cleanly", () => {
    const { database, repository } = createTestRepository();
    const space = createSpace(repository, {
      name: "Operations Core",
    });
    const updatedSpace = updateSpace(repository, {
      description: "Shared platform and internal systems work.",
      id: space.id,
      name: "Platform Core",
    });
    const extraHorizon = repository
      .getLedger()
      .horizons.find((horizon) => horizon.spaceId === space.id && horizon.key === "horizon_3");
    const updatedHorizon = updateHorizon(repository, {
      description: "Immediate platform priorities.",
      id: extraHorizon?.id ?? "",
      timeframeText: "Later planning work that still should be tracked.",
    });

    expect(updatedSpace.name).toBe("Platform Core");
    expect(updatedHorizon.description).toBe("Immediate platform priorities.");
    expect(updatedHorizon.timeframeText).toBe("Later planning work that still should be tracked.");

    database.close();
  });
});
