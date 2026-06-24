import { type AccessPolicy, canAccessBoard } from "../../../domain/AccessPolicy.ts";
import type { LedgerRepository } from "../../ports/MikroLensRepository.ts";
import { buildDocumentSummaries } from "../../queries/LedgerReadModels.ts";
import type { PlanLane, PlanSnapshot } from "../../readModels/PlanSnapshot.ts";

/**
 * @description Build the planning and roadmap view grounded in real work and documents.
 */
export function getPlanSnapshot(
  repository: LedgerRepository,
  spaceId?: string,
  accessPolicy: AccessPolicy | null = null,
): PlanSnapshot {
  const ledger = repository.getLedger();
  const documents = buildDocumentSummaries(ledger, { spaceId }, accessPolicy).filter(
    (document) => document.type === "Evolution",
  );
  const spaces = ledger.spaces.filter((space) =>
    spaceId
      ? space.id === spaceId &&
        (accessPolicy ? canAccessBoard(accessPolicy, space.id, "viewer") : true)
      : accessPolicy
        ? canAccessBoard(accessPolicy, space.id, "viewer")
        : true,
  );
  const lanes: PlanLane[] = spaces.map((space) => {
    const horizons = ledger.horizons
      .filter((horizon) => horizon.spaceId === space.id)
      .toSorted((left, right) => left.orderIndex - right.orderIndex);

    return {
      cells: horizons.map((horizon) => ({
        documents: documents.filter(
          (document) => document.spaceId === space.id && document.horizonKey === horizon.key,
        ),
        horizon,
        workItems: [],
      })),
      space,
    };
  });

  return {
    computed: lanes,
    horizons: ledger.horizonDefaults
      .toSorted((left, right) => left.orderIndex - right.orderIndex)
      .map((horizonDefault) => horizonDefault.label),
  };
}
