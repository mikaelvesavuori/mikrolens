import {
  getRouteSelectionKey,
  hasRouteSelection,
  resolveRouteSelection,
} from "../../../app/routing/routeSelection.js";

describe("route selection helpers", () => {
  it("detects when a record is selected by id or route key", () => {
    expect(hasRouteSelection({ id: "work_1" })).toBe(true);
    expect(hasRouteSelection({ routeKey: "ML-1" })).toBe(true);
    expect(hasRouteSelection({ id: "", routeKey: "" })).toBe(false);
  });

  it("prefers the explicit route key and falls back to snapshot refs", () => {
    const items = [{ id: "work_1", ref: "ML-1" }];

    expect(getRouteSelectionKey(items, { id: "work_1", routeKey: "ML-99" })).toBe("ML-99");
    expect(getRouteSelectionKey(items, { id: "work_1", routeKey: "" })).toBe("ML-1");
    expect(getRouteSelectionKey(items, { id: "missing", routeKey: "" })).toBe("missing");
  });

  it("resolves route selections against ids and refs from snapshot records", () => {
    const items = [{ id: "work_1", ref: "ML-1" }];

    expect(resolveRouteSelection(items, { id: "work_1", routeKey: "" })).toEqual({
      id: "work_1",
      routeKey: "ML-1",
    });
    expect(resolveRouteSelection(items, { id: "", routeKey: "ML-1" })).toEqual({
      id: "work_1",
      routeKey: "ML-1",
    });
    expect(resolveRouteSelection(items, { id: "", routeKey: "missing" })).toEqual({
      id: "",
      routeKey: "",
    });
  });
});
