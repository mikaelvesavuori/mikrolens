import type { AccessLevel } from "../../domain/AccessPolicy.ts";
import type { ApiIdentityDTO, ApiIdentityStatus } from "../../domain/ApiIdentity.ts";
import type { DocumentSummary, DocumentType } from "../../domain/Document.ts";
import type { HorizonDefaultDTO, HorizonDTO, HorizonKey } from "../../domain/Horizon.ts";
import type { SignalRecord, SignalStatus, SignalUrgency } from "../../domain/Signal.ts";
import type { SpaceDTO } from "../../domain/Space.ts";
import type { UserDTO, UserRole, UserStatus } from "../../domain/User.ts";
import type { WebhookEndpoint, WebhookEndpointStatus } from "../../domain/Webhook.ts";
import type {
  BoardWorkflowState,
  WorkflowState,
  WorkItemRecord,
  WorkItemType,
} from "../../domain/WorkItem.ts";
import type { PlanSnapshot } from "./PlanSnapshot.ts";
import type { SavedView } from "./SavedView.ts";
import type { UnderstandSnapshot } from "./UnderstandSnapshot.ts";

/**
 * @description Combined bootstrap payload used by the app shell.
 */
export interface BootstrapSnapshot {
  generatedAt: string;
  meta: {
    accessLevels: AccessLevel[];
    apiIdentityStatuses: ApiIdentityStatus[];
    boardWorkflowStates: BoardWorkflowState[];
    documentTypes: DocumentType[];
    horizonKeys: HorizonKey[];
    openApiPath: string;
    productName: string;
    signalUrgencies: SignalUrgency[];
    signalStatuses: SignalStatus[];
    userRoles: UserRole[];
    userStatuses: UserStatus[];
    webhookEndpointStatuses: WebhookEndpointStatus[];
    webhookEventTypes: string[];
    workItemTypes: WorkItemType[];
    workflowStates: WorkflowState[];
  };
  apiIdentities: ApiIdentityDTO[];
  users: UserDTO[];
  spaces: SpaceDTO[];
  horizons: HorizonDTO[];
  horizonDefaults: HorizonDefaultDTO[];
  views: SavedView[];
  webhooks: WebhookEndpoint[];
  workItems: WorkItemRecord[];
  signals: SignalRecord[];
  documents: DocumentSummary[];
  understand: UnderstandSnapshot;
  plan: PlanSnapshot;
}
