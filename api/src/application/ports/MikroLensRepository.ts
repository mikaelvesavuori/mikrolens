import type { ActivityEntityType, ActivityEvent } from "../../domain/Activity.ts";
import type { ApiIdentityDTO } from "../../domain/ApiIdentity.ts";
import type { DocumentDTO, DocumentLink } from "../../domain/Document.ts";
import type { HorizonDefaultDTO, HorizonDTO } from "../../domain/Horizon.ts";
import type { MagicLink } from "../../domain/MagicLink.ts";
import type { SignalDTO } from "../../domain/Signal.ts";
import type { SpaceDTO } from "../../domain/Space.ts";
import type { UserDTO } from "../../domain/User.ts";
import type { WebhookDelivery, WebhookEndpoint } from "../../domain/Webhook.ts";
import type { WorkItemDTO } from "../../domain/WorkItem.ts";
import type { SavedView } from "../readModels/SavedView.ts";

export interface LedgerData {
  activity: ActivityEvent[];
  apiIdentities: ApiIdentityDTO[];
  documentLinks: DocumentLink[];
  documents: DocumentDTO[];
  horizons: HorizonDTO[];
  horizonDefaults: HorizonDefaultDTO[];
  signals: SignalDTO[];
  spaces: SpaceDTO[];
  users: UserDTO[];
  views: SavedView[];
  webhooks: WebhookEndpoint[];
  workItems: WorkItemDTO[];
}

export interface TransactionBoundary {
  transaction<T>(operation: () => T): T;
}

export interface LedgerRepository {
  getLedger(): LedgerData;
}

export interface SpaceRepository {
  listSpaces(): SpaceDTO[];
  getSpace(id: string): SpaceDTO | null;
  saveSpace(space: SpaceDTO): void;
}

export interface HorizonRepository {
  listHorizons(): HorizonDTO[];
  getHorizon(id: string): HorizonDTO | null;
  saveHorizon(horizon: HorizonDTO): void;
}

export interface HorizonDefaultsRepository {
  listHorizonDefaults(): HorizonDefaultDTO[];
  getHorizonDefault(key: string): HorizonDefaultDTO | null;
  saveHorizonDefault(horizonDefault: HorizonDefaultDTO): void;
}

export interface WorkItemRepository {
  listWorkItems(): WorkItemDTO[];
  getWorkItem(id: string): WorkItemDTO | null;
  saveWorkItem(workItem: WorkItemDTO): void;
  deleteWorkItem(id: string): void;
}

export interface SignalRepository {
  listSignals(): SignalDTO[];
  getSignal(id: string): SignalDTO | null;
  saveSignal(signal: SignalDTO): void;
  deleteSignal(id: string): void;
}

export interface DocumentRepository {
  listDocuments(): DocumentDTO[];
  getDocument(id: string): DocumentDTO | null;
  saveDocument(document: DocumentDTO): void;
  deleteDocument(id: string): void;
  listDocumentLinks(): DocumentLink[];
  saveDocumentLink(link: DocumentLink): void;
  deleteDocumentLink(workItemId: string, documentId: string): void;
  deleteDocumentLinksForWorkItem(workItemId: string): void;
  deleteDocumentLinksForDocument(documentId: string): void;
}

export interface SavedViewRepository {
  listViews(): SavedView[];
}

export interface ApiIdentityRepository {
  listApiIdentities(): ApiIdentityDTO[];
  getApiIdentity(id: string): ApiIdentityDTO | null;
  saveApiIdentity(identity: ApiIdentityDTO): void;
  replaceApiIdentityToken(apiIdentityId: string, tokenHash: string, rotatedAt: string): void;
  findApiIdentityByTokenHash(tokenHash: string): ApiIdentityDTO | null;
}

export interface ActivityRepository {
  saveActivity(event: ActivityEvent): void;
  deleteActivityForEntity(entityType: ActivityEntityType, entityId: string): void;
  listActivity(limit?: number): ActivityEvent[];
}

export interface WebhookEndpointRepository {
  listWebhookEndpoints(): WebhookEndpoint[];
  getWebhookEndpoint(id: string): WebhookEndpoint | null;
  saveWebhookEndpoint(endpoint: WebhookEndpoint): void;
  deleteWebhookEndpoint(id: string): void;
  listWebhookDeliveries(endpointId: string, limit?: number): WebhookDelivery[];
}

export interface WebhookDeliveryRepository {
  enqueueWebhookDeliveries(activity: ActivityEvent): void;
  releaseStaleWebhookClaims(staleBefore: string): void;
  claimPendingWebhookDeliveries(workerId: string, now: string, limit: number): WebhookDelivery[];
  markWebhookDeliveryDelivered(id: string, deliveredAt: string, attemptCount: number): void;
  rescheduleWebhookDelivery(
    id: string,
    nextAttemptAt: string,
    error: string,
    attemptCount: number,
  ): void;
  failWebhookDelivery(id: string, error: string, attemptCount: number): void;
}

export interface UserRepository {
  listUsers(): UserDTO[];
  getUser(id: string): UserDTO | null;
  getUserByEmail(email: string): UserDTO | null;
  saveUser(user: UserDTO): void;
  deleteUser(id: string): void;
}

export interface MagicLinkRepository {
  saveMagicLink(link: MagicLink): void;
  getMagicLinkByTokenHash(tokenHash: string): MagicLink | null;
  revokeActiveMagicLinksForUser(userId: string, revokedAt: string): void;
  markMagicLinkUsed(id: string, usedAt: string): void;
  deleteMagicLink(id: string): void;
}

export interface MikroLensRepository
  extends TransactionBoundary,
    LedgerRepository,
    SpaceRepository,
    HorizonRepository,
    HorizonDefaultsRepository,
    WorkItemRepository,
    SignalRepository,
    DocumentRepository,
    SavedViewRepository,
    ApiIdentityRepository,
    ActivityRepository,
    WebhookEndpointRepository,
    WebhookDeliveryRepository,
    UserRepository,
    MagicLinkRepository {}

export type BoardCatalogRepository = Pick<SpaceRepository, "listSpaces">;
export type AccessPolicyCatalogRepository = BoardCatalogRepository;
export type DocumentDetailRepository = LedgerRepository & DocumentRepository;
export type DomainEventRepository = ActivityRepository & WebhookDeliveryRepository;
export type MagicLinkAuthRepository = MagicLinkRepository & UserRepository;
export type WebhookWorkerRepository = WebhookEndpointRepository & WebhookDeliveryRepository;
export type WebhookListRepository = Pick<WebhookEndpointRepository, "listWebhookEndpoints">;
export type WebhookCreationRepository = Pick<SpaceRepository, "getSpace"> &
  Pick<WebhookEndpointRepository, "saveWebhookEndpoint">;
export type WebhookUpdateRepository = Pick<SpaceRepository, "getSpace"> &
  Pick<WebhookEndpointRepository, "getWebhookEndpoint" | "saveWebhookEndpoint">;
export type WebhookDeletionRepository = Pick<
  WebhookEndpointRepository,
  "getWebhookEndpoint" | "deleteWebhookEndpoint"
>;
export type WebhookDeliveriesRepository = Pick<
  WebhookEndpointRepository,
  "getWebhookEndpoint" | "listWebhookDeliveries"
>;
export type SpaceCreationRepository = Pick<SpaceRepository, "listSpaces" | "saveSpace"> &
  Pick<HorizonRepository, "saveHorizon"> &
  Pick<HorizonDefaultsRepository, "listHorizonDefaults">;
export type SpaceUpdateRepository = Pick<SpaceRepository, "getSpace" | "listSpaces" | "saveSpace">;
export type HorizonCreationRepository = Pick<SpaceRepository, "listSpaces"> &
  Pick<HorizonRepository, "listHorizons" | "saveHorizon"> &
  Pick<HorizonDefaultsRepository, "getHorizonDefault">;
export type HorizonUpdateRepository = Pick<HorizonRepository, "getHorizon" | "saveHorizon"> &
  Pick<HorizonDefaultsRepository, "getHorizonDefault">;
export type HorizonDefaultUpdateRepository = Pick<
  HorizonDefaultsRepository,
  "getHorizonDefault" | "saveHorizonDefault"
>;
export type UserCreationRepository = Pick<UserRepository, "getUserByEmail" | "saveUser">;
export type UserUpdateRepository = Pick<UserRepository, "getUser" | "saveUser">;
export type UserDeletionRepository = Pick<UserRepository, "getUser" | "deleteUser">;
export type UserInvitationRepository = UserCreationRepository & Pick<UserRepository, "deleteUser">;
export type ManagedUserInvitationRepository = AccessPolicyCatalogRepository &
  UserInvitationRepository;
export type ManagedUserUpdateRepository = AccessPolicyCatalogRepository & UserUpdateRepository;
export type OAuthUserSignInRepository = Pick<UserRepository, "getUserByEmail" | "saveUser">;
export type ApiIdentityCreationRepository = Pick<
  ApiIdentityRepository,
  "replaceApiIdentityToken" | "saveApiIdentity"
>;
export type ApiIdentityUpdateRepository = Pick<
  ApiIdentityRepository,
  "getApiIdentity" | "saveApiIdentity"
>;
export type ManagedApiIdentityCreationRepository = AccessPolicyCatalogRepository &
  ApiIdentityCreationRepository;
export type ManagedApiIdentityUpdateRepository = AccessPolicyCatalogRepository &
  ApiIdentityUpdateRepository;
export type ApiIdentityRotationRepository = Pick<
  ApiIdentityRepository,
  "getApiIdentity" | "replaceApiIdentityToken" | "saveApiIdentity"
>;
export type SignalCreationRepository = TransactionBoundary &
  LedgerRepository &
  Pick<SignalRepository, "listSignals" | "saveSignal"> &
  DomainEventRepository;
export type SignalUpdateRepository = TransactionBoundary &
  LedgerRepository &
  Pick<SignalRepository, "getSignal" | "saveSignal"> &
  DomainEventRepository;
export type SignalDeletionRepository = TransactionBoundary &
  LedgerRepository &
  Pick<SignalRepository, "deleteSignal"> &
  Pick<ActivityRepository, "deleteActivityForEntity">;
export type WorkItemCreationRepository = TransactionBoundary &
  LedgerRepository &
  Pick<SpaceRepository, "listSpaces"> &
  Pick<HorizonRepository, "listHorizons"> &
  Pick<UserRepository, "listUsers"> &
  Pick<WorkItemRepository, "listWorkItems" | "saveWorkItem"> &
  DomainEventRepository;
export type WorkItemUpdateRepository = TransactionBoundary &
  LedgerRepository &
  Pick<HorizonRepository, "listHorizons"> &
  Pick<UserRepository, "listUsers"> &
  Pick<WorkItemRepository, "getWorkItem" | "saveWorkItem"> &
  DomainEventRepository;
export type WorkItemDeletionRepository = TransactionBoundary &
  LedgerRepository &
  Pick<WorkItemRepository, "deleteWorkItem"> &
  Pick<SignalRepository, "listSignals" | "saveSignal"> &
  Pick<DocumentRepository, "deleteDocumentLinksForWorkItem"> &
  Pick<ActivityRepository, "deleteActivityForEntity">;
export type DocumentDeletionRepository = TransactionBoundary &
  LedgerRepository &
  Pick<DocumentRepository, "deleteDocument" | "deleteDocumentLinksForDocument"> &
  Pick<ActivityRepository, "deleteActivityForEntity">;
export type DocumentUpdateRepository = TransactionBoundary &
  LedgerRepository &
  Pick<HorizonRepository, "listHorizons"> &
  Pick<DocumentRepository, "getDocument" | "saveDocument"> &
  DomainEventRepository;
export type DocumentCreationRepository = TransactionBoundary &
  LedgerRepository &
  Pick<SpaceRepository, "listSpaces"> &
  Pick<HorizonRepository, "listHorizons"> &
  Pick<DocumentRepository, "saveDocument"> &
  DomainEventRepository;
export type DocumentLinkingRepository = TransactionBoundary &
  LedgerRepository &
  Pick<WorkItemRepository, "getWorkItem"> &
  Pick<DocumentRepository, "getDocument" | "saveDocumentLink"> &
  DomainEventRepository;
export type DocumentUnlinkingRepository = TransactionBoundary &
  LedgerRepository &
  Pick<WorkItemRepository, "getWorkItem"> &
  Pick<DocumentRepository, "getDocument" | "deleteDocumentLink"> &
  DomainEventRepository;
export type SignalPullRepository = TransactionBoundary &
  Pick<SpaceRepository, "listSpaces"> &
  Pick<SignalRepository, "getSignal" | "saveSignal"> &
  WorkItemCreationRepository;
