export function getDocumentLinkCandidates(options = {}) {
  const linkedDocumentIds =
    options.linkedDocumentIds instanceof Set
      ? options.linkedDocumentIds
      : new Set(options.linkedDocumentIds ?? []);
  const sourceDocuments =
    Array.isArray(options.allDocuments) && options.allDocuments.length > 0
      ? options.allDocuments
      : Array.isArray(options.visibleDocuments)
        ? options.visibleDocuments
        : [];

  return [...sourceDocuments]
    .filter((document) => !linkedDocumentIds.has(document.id))
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function formatDocumentLinkLabel(document) {
  return document.title;
}

export function sortLinkedDocuments(documents = []) {
  const typeOrder = new Map([
    ["Evolution", 0],
    ["Strategy", 1],
    ["Note", 2],
  ]);

  return [...documents].sort((left, right) => {
    return (
      (typeOrder.get(left.type) ?? 99) - (typeOrder.get(right.type) ?? 99) ||
      getDocumentHorizonOrder(left) - getDocumentHorizonOrder(right) ||
      (left.spaceName ?? "").localeCompare(right.spaceName ?? "") ||
      left.title.localeCompare(right.title)
    );
  });
}

function getDocumentHorizonOrder(document) {
  const value = document?.horizonKey ?? document?.horizonName ?? "";
  const order = {
    Now: 0,
    Next: 1,
    Later: 2,
    horizon_1: 0,
    horizon_2: 1,
    horizon_3: 2,
  };

  return order[value] ?? 99;
}
