import { type AccessPolicy, accessLevels, canAccessBoard } from "../../../domain/AccessPolicy.ts";
import { apiIdentityStatuses } from "../../../domain/ApiIdentity.ts";
import { documentTypes } from "../../../domain/Document.ts";
import { horizonKeys } from "../../../domain/Horizon.ts";
import { signalStatuses, signalUrgencies } from "../../../domain/Signal.ts";
import { userRoles, userStatuses } from "../../../domain/User.ts";
import { webhookEndpointStatuses, webhookEventTypes } from "../../../domain/Webhook.ts";
import { boardWorkflowStates, workflowStates, workItemTypes } from "../../../domain/WorkItem.ts";
import type { LedgerRepository } from "../../ports/MikroLensRepository.ts";
import {
  buildDocumentSummaries,
  buildSignalRecords,
  buildWorkItemRecords,
} from "../../queries/LedgerReadModels.ts";
import type { BootstrapSnapshot } from "../../readModels/BootstrapSnapshot.ts";
import { getPlanSnapshot } from "./getPlanSnapshot.ts";
import { getUnderstandSnapshot } from "./getUnderstandSnapshot.ts";

/**
 * @description Build the app's initial data payload.
 */
export function getBootstrapSnapshot(
  repository: LedgerRepository,
  spaceId?: string,
  options: {
    includeAdministration?: boolean;
    recordAccessPolicy?: AccessPolicy | null;
  } = {},
): BootstrapSnapshot {
  const ledger = repository.getLedger();
  const recordAccessPolicy = options.recordAccessPolicy ?? null;
  const visibleSpaces = ledger.spaces.filter((space) =>
    recordAccessPolicy ? canAccessBoard(recordAccessPolicy, space.id, "viewer") : true,
  );
  const visibleSpaceIds = new Set(visibleSpaces.map((space) => space.id));
  const includeAdministration = Boolean(options.includeAdministration);

  return {
    apiIdentities: includeAdministration ? ledger.apiIdentities : [],
    documents: buildDocumentSummaries(ledger, { spaceId }, recordAccessPolicy),
    generatedAt: new Date().toISOString(),
    horizons: ledger.horizons.filter(
      (horizon) =>
        visibleSpaceIds.has(horizon.spaceId) && (spaceId ? horizon.spaceId === spaceId : true),
    ),
    horizonDefaults: includeAdministration ? ledger.horizonDefaults : [],
    meta: {
      accessLevels: [...accessLevels],
      apiIdentityStatuses: [...apiIdentityStatuses],
      boardWorkflowStates: [...boardWorkflowStates],
      documentTypes: [...documentTypes],
      horizonKeys: [...horizonKeys],
      openApiPath: "/openapi.json",
      productName: "MikroLens",
      signalStatuses: [...signalStatuses],
      signalUrgencies: [...signalUrgencies],
      userRoles: [...userRoles],
      userStatuses: [...userStatuses],
      webhookEndpointStatuses: [...webhookEndpointStatuses],
      webhookEventTypes: [...webhookEventTypes],
      workItemTypes: [...workItemTypes],
      workflowStates: [...workflowStates],
    },
    plan: getPlanSnapshot(repository, spaceId, recordAccessPolicy),
    spaces: visibleSpaces.filter((space) => (spaceId ? space.id === spaceId : true)),
    understand: getUnderstandSnapshot(repository, spaceId, recordAccessPolicy),
    users: ledger.users,
    views: ledger.views,
    webhooks: includeAdministration
      ? ledger.webhooks.map((webhook) => ({
          ...webhook,
          secret: "",
        }))
      : [],
    signals: buildSignalRecords(ledger, recordAccessPolicy),
    workItems: buildWorkItemRecords(ledger, { spaceId }, recordAccessPolicy),
  };
}
