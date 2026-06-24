import { getPlanSnapshot } from "../../../../src/application/usecases/snapshots/getPlanSnapshot.ts";
import { createTestRepository } from "../../../support/testUtils.ts";

describe("getPlanSnapshot", () => {
  it("builds an evolution-only roadmap grouped by spaces and horizons", () => {
    const { database, repository } = createTestRepository();

    const snapshot = getPlanSnapshot(repository);
    const iamLane = snapshot.computed.find((lane) => lane.space.id === "space_iam");
    const iamNextCell = iamLane?.cells.find((cell) => cell.horizon.name === "Next");
    const productLane = snapshot.computed.find((lane) => lane.space.id === "space_product");
    const productNextCell = productLane?.cells.find((cell) => cell.horizon.name === "Next");

    expect(snapshot.horizons).toEqual(["Now", "Next", "Later"]);
    expect(iamLane).toBeTruthy();
    expect(iamNextCell?.documents.map((document) => document.title)).toEqual([
      "Machine token revocation",
    ]);
    expect(iamNextCell?.documents.every((document) => document.type === "Evolution")).toBe(true);
    expect(productNextCell?.documents).toEqual([]);
    expect(
      snapshot.computed.flatMap((lane) => lane.cells).every((cell) => cell.workItems.length === 0),
    ).toBe(true);

    database.close();
  });
});
