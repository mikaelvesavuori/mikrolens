export function getEvolutionDocuments(workItem) {
  return [...(workItem.linkedDocuments ?? [])]
    .filter((document) => document.type === "Evolution")
    .sort(sortEvolutionDocuments);
}

export function getPrimaryEvolutionDocument(workItem) {
  return getEvolutionDocuments(workItem)[0] ?? null;
}

export function getWorkItemsGroupedByEvolution(items, sortItems = (entries) => entries) {
  const groupsById = new Map();

  for (const item of items) {
    const evolutions = getEvolutionDocuments(item);

    if (evolutions.length === 0) {
      const existing = groupsById.get("__standalone__") ?? {
        document: null,
        id: "__standalone__",
        items: [],
        kind: "standalone",
      };

      existing.items.push(item);
      groupsById.set(existing.id, existing);
      continue;
    }

    for (const evolution of evolutions) {
      const existing = groupsById.get(evolution.id) ?? {
        document: evolution,
        id: evolution.id,
        items: [],
        kind: "evolution",
      };

      existing.items.push(item);
      groupsById.set(existing.id, existing);
    }
  }

  return [...groupsById.values()]
    .map((group) => ({
      ...group,
      items: sortItems(group.items),
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "evolution" ? -1 : 1;
      }

      if (!left.document || !right.document) {
        return 0;
      }

      return sortEvolutionDocuments(left.document, right.document);
    });
}

export function sortEvolutionDocuments(left, right) {
  return (
    getEvolutionHorizonOrder(left) - getEvolutionHorizonOrder(right) ||
    (left.spaceName ?? "").localeCompare(right.spaceName ?? "") ||
    left.title.localeCompare(right.title)
  );
}

function getEvolutionHorizonOrder(document) {
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
