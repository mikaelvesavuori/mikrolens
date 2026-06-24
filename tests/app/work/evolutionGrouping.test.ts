import {
  getPrimaryEvolutionDocument,
  getWorkItemsGroupedByEvolution,
} from "../../../app/work/evolutionGrouping.js";

describe("evolution grouping", () => {
  it("places a work item into every linked Evolution group", () => {
    const workItem = {
      id: "work_item_1",
      linkedDocuments: [
        {
          horizonName: "Next",
          id: "document_b",
          spaceName: "IAM",
          title: "IAM hardening",
          type: "Evolution",
        },
        {
          horizonName: "Now",
          id: "document_a",
          spaceName: "IAM",
          title: "Access review",
          type: "Evolution",
        },
        {
          horizonName: "Now",
          id: "document_note",
          spaceName: "IAM",
          title: "Supporting note",
          type: "Note",
        },
      ],
      ref: "ML-1",
    };

    const groups = getWorkItemsGroupedByEvolution([workItem]);

    expect(groups.map((group) => group.id)).toEqual(["document_a", "document_b"]);
    expect(groups[0].items).toEqual([workItem]);
    expect(groups[1].items).toEqual([workItem]);
  });

  it("keeps items without Evolution links in the standalone group", () => {
    const workItem = {
      id: "work_item_2",
      linkedDocuments: [
        {
          horizonName: "Now",
          id: "document_note",
          spaceName: "IAM",
          title: "Supporting note",
          type: "Note",
        },
      ],
      ref: "ML-2",
    };

    const groups = getWorkItemsGroupedByEvolution([workItem]);

    expect(groups).toEqual([
      {
        document: null,
        id: "__standalone__",
        items: [workItem],
        kind: "standalone",
      },
    ]);
  });

  it("still resolves the primary evolution from the sorted Evolution set", () => {
    const workItem = {
      id: "work_item_3",
      linkedDocuments: [
        {
          horizonName: "Later",
          id: "document_b",
          spaceName: "IAM",
          title: "IAM hardening",
          type: "Evolution",
        },
        {
          horizonName: "Now",
          id: "document_a",
          spaceName: "IAM",
          title: "Access review",
          type: "Evolution",
        },
      ],
      ref: "ML-3",
    };

    expect(getPrimaryEvolutionDocument(workItem)?.id).toBe("document_a");
  });
});
