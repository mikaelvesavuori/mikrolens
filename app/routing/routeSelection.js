export function hasRouteSelection(selection) {
  return Boolean(selection?.id || selection?.routeKey);
}

export function getRouteSelectionKey(items, selection) {
  if (selection?.routeKey) {
    return selection.routeKey;
  }

  const selectedRecord = items?.find((item) => item.id === selection?.id) ?? null;

  return selectedRecord?.ref ?? selection?.id ?? "";
}

export function resolveRouteSelection(items, selection) {
  if (!hasRouteSelection(selection)) {
    return {
      id: "",
      routeKey: "",
    };
  }

  const selectedRecord =
    items?.find(
      (item) =>
        item.id === selection?.id ||
        item.id === selection?.routeKey ||
        item.ref === selection?.routeKey,
    ) ?? null;

  if (!selectedRecord) {
    return {
      id: "",
      routeKey: "",
    };
  }

  return {
    id: selectedRecord.id,
    routeKey: selectedRecord.ref ?? selectedRecord.id,
  };
}
