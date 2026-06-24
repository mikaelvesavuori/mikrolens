import type { SavedView } from "../../application/readModels/SavedView.ts";
import type { ActivityEvent } from "../../domain/Activity.ts";
import type { ApiIdentityDTO } from "../../domain/ApiIdentity.ts";
import type { DocumentDTO, DocumentLink } from "../../domain/Document.ts";
import type { HorizonDefaultDTO, HorizonDTO, HorizonKey } from "../../domain/Horizon.ts";
import type { SpaceDTO } from "../../domain/Space.ts";
import type { UserDTO } from "../../domain/User.ts";
import type { WorkItemDTO } from "../../domain/WorkItem.ts";

export interface SeedData {
  activity: ActivityEvent[];
  apiIdentities: ApiIdentityDTO[];
  documentLinks: DocumentLink[];
  documents: DocumentDTO[];
  horizons: HorizonDTO[];
  horizonDefaults: HorizonDefaultDTO[];
  spaces: SpaceDTO[];
  users: UserDTO[];
  views: SavedView[];
  workItems: WorkItemDTO[];
}

const baseCreatedAt = "2026-01-08T09:00:00.000Z";

const spaceIds = {
  iam: "space_iam",
  platform: "space_platform",
  product: "space_product",
  storage: "space_storage",
} as const;

const horizonIds = {
  iam: {
    later: "horizon_iam_later",
    next: "horizon_iam_next",
    now: "horizon_iam_now",
  },
  platform: {
    later: "horizon_platform_later",
    next: "horizon_platform_next",
    now: "horizon_platform_now",
  },
  product: {
    later: "horizon_product_later",
    next: "horizon_product_next",
    now: "horizon_product_now",
  },
  storage: {
    later: "horizon_storage_later",
    next: "horizon_storage_next",
    now: "horizon_storage_now",
  },
} as const;

const documentIds = {
  accessReviewExports: "Q9m2Kx7P",
  clarityWithoutCeremony: "V4n8Rt2L",
  denseList: "D7p3Xc9M",
  incidentReviewMemo: "H2k6Ws8Q",
  machineTokenRevocation: "N5v1Jy4R",
  policySimulatorBrief: "P8t4Lf6Z",
  q2Reliability: "R3c7Bn5T",
  restoreFlow: "S6d2Hg9K",
  savedViews: "Y1m8Qa4W",
} as const;

const workItemIds = {
  accessReviewExports: "a4K9mP2x",
  archiveDuplicates: "b7N3qR5v",
  breakGlassDoc: "c2T8wL6j",
  buildAgentLogs: "d5Y1uH9n",
  focusReviewTemplate: "e8J4pS2k",
  denseListLaunch: "f3M7xD5q",
  deploymentFreezeGuardrails: "g6R2vK8t",
  policySimulator: "h9W5nP3m",
  restoreAuditEvents: "j4C8qT6x",
  restoreTriageIntake: "k7F1rV9p",
  resumableCopy: "m2H6yL4s",
  rotationEmailContext: "n5K9dQ7w",
  savedViews: "p8N3gR1y",
  strategyTraceability: "q1T5mX8d",
  tokenRevocationModel: "r4V7pC2h",
  webhookRetryNoise: "s9Y2kM6n",
} as const;

const userIds = {
  amina: "user_amina",
  jonas: "user_jonas",
  lea: "user_lea",
  mikael: "user_mikael",
  sara: "user_sara",
} as const;

const apiIdentities: ApiIdentityDTO[] = [
  {
    createdAt: "2026-02-02T08:30:00.000Z",
    description: "Handles release note publication and changelog sync jobs.",
    id: "u3L8pQ5r",
    lastUsedAt: "2026-03-28T16:12:00.000Z",
    name: "Release Bot",
    permissions: {
      boards: {
        level: "editor",
        scope: "all",
      },
      documents: "editor",
      signals: "viewer",
    },
    status: "Active",
    tokenLastRotatedAt: "2026-03-21T10:00:00.000Z",
    updatedAt: "2026-03-28T16:12:00.000Z",
  },
  {
    createdAt: "2026-02-18T11:10:00.000Z",
    description: "Reserved for nightly governance checks across IAM and storage surfaces.",
    id: "v6N1tW4x",
    lastUsedAt: null,
    name: "Governance Audit",
    permissions: {
      boards: {
        grants: [
          {
            boardId: spaceIds.iam,
            level: "admin",
          },
          {
            boardId: spaceIds.storage,
            level: "admin",
          },
        ],
        scope: "boards",
      },
      documents: "viewer",
      signals: "viewer",
    },
    status: "Paused",
    tokenLastRotatedAt: null,
    updatedAt: "2026-03-18T09:15:00.000Z",
  },
];

const spaces: SpaceDTO[] = [
  {
    accent: "#2d6cdf",
    createdAt: baseCreatedAt,
    description: "Core delivery platform, deployment flow, and operating guardrails.",
    id: spaceIds.platform,
    name: "Platform",
    updatedAt: "2026-03-27T16:12:00.000Z",
  },
  {
    accent: "#1f7c59",
    createdAt: baseCreatedAt,
    description: "Authentication, access, tokens, and identity lifecycle work.",
    id: spaceIds.iam,
    name: "IAM",
    updatedAt: "2026-03-28T08:45:00.000Z",
  },
  {
    accent: "#9a6430",
    createdAt: baseCreatedAt,
    description: "Storage controls, recovery, retention, and large-object handling.",
    id: spaceIds.storage,
    name: "Storage",
    updatedAt: "2026-03-27T11:20:00.000Z",
  },
  {
    accent: "#b4552d",
    createdAt: baseCreatedAt,
    description: "Product-wide experience, work design, and planning language.",
    id: spaceIds.product,
    name: "Product Experience",
    updatedAt: "2026-03-28T10:15:00.000Z",
  },
];

const users: UserDTO[] = [
  createSeedUser({
    email: "mikael@example.com",
    id: userIds.mikael,
    name: "Mikael",
    role: "Admin",
  }),
  createSeedUser({
    email: "sara@example.com",
    id: userIds.sara,
    name: "Sara",
  }),
  createSeedUser({
    email: "amina@example.com",
    id: userIds.amina,
    name: "Amina",
  }),
  createSeedUser({
    email: "lea@example.com",
    id: userIds.lea,
    name: "Lea",
  }),
  createSeedUser({
    email: "jonas@example.com",
    id: userIds.jonas,
    name: "Jonas",
  }),
];

const horizonDefaults: HorizonDefaultDTO[] = [
  {
    createdAt: baseCreatedAt,
    description: "Immediate work and current planning focus.",
    key: "horizon_1",
    label: "Now",
    orderIndex: 0,
    timeframeText: "Current work and near-term pull decisions.",
    updatedAt: baseCreatedAt,
  },
  {
    createdAt: baseCreatedAt,
    description: "Upcoming work that should stay visible but is not active yet.",
    key: "horizon_2",
    label: "Next",
    orderIndex: 1,
    timeframeText: "Likely next work once ready enough to pull.",
    updatedAt: baseCreatedAt,
  },
  {
    createdAt: baseCreatedAt,
    description: "Longer-range ideas and commitments that are not ready to pull forward.",
    key: "horizon_3",
    label: "Later",
    orderIndex: 2,
    timeframeText: "Longer-horizon bets and preserved candidates.",
    updatedAt: baseCreatedAt,
  },
];

function createSeedHorizon(input: {
  description?: string;
  id: string;
  key: HorizonKey;
  label?: string;
  spaceId: string;
  timeframeText?: string;
}) {
  const horizonDefault = horizonDefaults.find((entry) => entry.key === input.key);

  if (!horizonDefault) {
    throw new Error(`Missing Horizon default for ${input.key}.`);
  }

  const label = input.label ?? horizonDefault.label;
  const description = input.description ?? horizonDefault.description;
  const timeframeText = input.timeframeText ?? horizonDefault.timeframeText;
  const labelOverride = label === horizonDefault.label ? null : label;
  const descriptionOverride = description === horizonDefault.description ? null : description;
  const timeframeTextOverride =
    timeframeText === horizonDefault.timeframeText ? null : timeframeText;

  return {
    createdAt: baseCreatedAt,
    description,
    descriptionOverride,
    id: input.id,
    inheritsDefault: !labelOverride && !descriptionOverride && !timeframeTextOverride,
    key: input.key,
    label,
    labelOverride,
    name: label,
    orderIndex: horizonDefault.orderIndex,
    spaceId: input.spaceId,
    timeframeText,
    timeframeTextOverride,
    updatedAt: baseCreatedAt,
  } satisfies HorizonDTO;
}

const horizons: HorizonDTO[] = [
  createSeedHorizon({ id: horizonIds.platform.now, key: "horizon_1", spaceId: spaceIds.platform }),
  createSeedHorizon({ id: horizonIds.platform.next, key: "horizon_2", spaceId: spaceIds.platform }),
  createSeedHorizon({
    id: horizonIds.platform.later,
    key: "horizon_3",
    spaceId: spaceIds.platform,
  }),
  createSeedHorizon({ id: horizonIds.iam.now, key: "horizon_1", spaceId: spaceIds.iam }),
  createSeedHorizon({ id: horizonIds.iam.next, key: "horizon_2", spaceId: spaceIds.iam }),
  createSeedHorizon({ id: horizonIds.iam.later, key: "horizon_3", spaceId: spaceIds.iam }),
  createSeedHorizon({ id: horizonIds.storage.now, key: "horizon_1", spaceId: spaceIds.storage }),
  createSeedHorizon({ id: horizonIds.storage.next, key: "horizon_2", spaceId: spaceIds.storage }),
  createSeedHorizon({ id: horizonIds.storage.later, key: "horizon_3", spaceId: spaceIds.storage }),
  createSeedHorizon({ id: horizonIds.product.now, key: "horizon_1", spaceId: spaceIds.product }),
  createSeedHorizon({ id: horizonIds.product.next, key: "horizon_2", spaceId: spaceIds.product }),
  createSeedHorizon({ id: horizonIds.product.later, key: "horizon_3", spaceId: spaceIds.product }),
];

const documents: DocumentDTO[] = [
  {
    createdAt: "2026-02-20T08:15:00.000Z",
    horizonId: horizonIds.product.next,
    id: documentIds.clarityWithoutCeremony,
    markdown: `# Clarity without ceremony

MikroLens should help teams understand what matters, decide responsibly, and move work without ritual overhead.

## Principles

- Keep execution views operational, not performative.
- Keep planning lighter than day-to-day work.
- Preserve reasoning next to the work it informs.
- Surface staleness and slipped work as system signals.

## Implications

- Work boards are state-driven, never planning-window-driven.
- Dense list views are first-class.
- Saved views should make common perspectives reusable without inventing new object types.
`,
    spaceId: spaceIds.product,
    summary: "Product strategy note anchoring MikroLens's anti-bureaucratic posture.",
    title: "Clarity without ceremony",
    type: "Strategy",
    updatedAt: "2026-03-26T12:05:00.000Z",
  },
  {
    createdAt: "2026-03-11T09:00:00.000Z",
    horizonId: horizonIds.iam.now,
    id: documentIds.accessReviewExports,
    markdown: `# Access review exports

The current export path is timing out for the largest tenants because the aggregation step is too coarse.

## Current pain

- Exports can take hours.
- Customers do not know whether the request is still alive.
- Support lacks clear operational signals.

## Expected evolution

Move export generation onto streamed batches and make waiting states visible in the work system.
`,
    spaceId: spaceIds.iam,
    summary: "Explains the enterprise export timeout pattern and likely recovery path.",
    title: "Access review export evolution",
    type: "Evolution",
    updatedAt: "2026-03-27T13:10:00.000Z",
  },
  {
    createdAt: "2026-03-05T13:40:00.000Z",
    horizonId: horizonIds.storage.next,
    id: documentIds.restoreFlow,
    markdown: `# Restore flow evolution

Restore-related work is arriving faster than it is being triaged. We need a calmer intake and clearer operational slices.

## Needed changes

- Separate urgent restore failures from policy questions.
- Improve audit signal when restores are replayed.
- Add a visible review cadence for parked restore ideas.
`,
    spaceId: spaceIds.storage,
    summary: "Narrative document linking restore bugs, triage debt, and roadmap framing.",
    title: "Restore flow evolution",
    type: "Evolution",
    updatedAt: "2026-03-25T16:15:00.000Z",
  },
  {
    createdAt: "2026-03-18T11:25:00.000Z",
    horizonId: horizonIds.product.next,
    id: documentIds.savedViews,
    markdown: `# Saved views

Saved views should stay lightweight and behave like perspectives, not new work objects.

## Good first cuts

- Blocked now
- Inbox triage
- Next horizon
- Stale active work
`,
    spaceId: spaceIds.product,
    summary: "Idea note defining saved views as perspectives rather than ontology.",
    title: "Saved views should stay light",
    type: "Note",
    updatedAt: "2026-03-27T08:55:00.000Z",
  },
  {
    createdAt: "2026-03-27T07:05:00.000Z",
    horizonId: horizonIds.platform.now,
    id: documentIds.incidentReviewMemo,
    markdown: `# Incident review memo pattern

Use one concise memo to explain what happened, what changed, and what we are doing next.

> Good reviews reduce future confusion more than they preserve every event.

## Template

1. State the customer-visible impact.
2. Name the broken assumption.
3. Show the decision that changed after investigation.

## Checklist

- [x] Link the work item that drove the follow-up.
- [ ] Capture the signal that should have gone red sooner.
- [ ] Close the memo when the fix is visible in production.

---

## Example operator check

\`\`\`bash
kubectl logs deploy/agent-worker --since=15m
\`\`\`
`,
    spaceId: spaceIds.platform,
    summary: "Short-form incident memo template for calmer, sharper operational writeups.",
    title: "Incident review memo pattern",
    type: "Note",
    updatedAt: "2026-03-29T08:20:00.000Z",
  },
  {
    createdAt: "2026-02-28T07:45:00.000Z",
    horizonId: horizonIds.platform.next,
    id: documentIds.q2Reliability,
    markdown: `# Q2 reliability focus

Reliability work should reduce avoidable waiting and recovery noise without creating slower release habits.

## Focus themes

- Better deployment confidence signals
- Cleaner operator feedback loops
- Less duplicated incident follow-up work
`,
    spaceId: spaceIds.platform,
    summary: "Strategy for reliability work that avoids introducing bureaucracy.",
    title: "Q2 reliability focus",
    type: "Strategy",
    updatedAt: "2026-03-24T09:05:00.000Z",
  },
  {
    createdAt: "2026-03-16T10:20:00.000Z",
    horizonId: horizonIds.iam.next,
    id: documentIds.machineTokenRevocation,
    markdown: `# Machine token revocation

Machine users need a clearer revocation model than humans because customer automation tends to assume long-lived credentials.

## Questions to resolve

- Should revocation be immediate or next-use?
- What audit evidence do we want to preserve?
- How should break-glass credentials behave?
`,
    spaceId: spaceIds.iam,
    summary: "Exploration of safer revocation behavior for machine-user tokens.",
    title: "Machine token revocation",
    type: "Evolution",
    updatedAt: "2026-03-26T14:25:00.000Z",
  },
  {
    createdAt: "2026-03-08T14:10:00.000Z",
    horizonId: horizonIds.storage.later,
    id: documentIds.policySimulatorBrief,
    markdown: `# Policy simulator as a customer decision aid

Customers should be able to understand retention-rule consequences before they commit a high-risk change.

## Why it matters

- Retention policy changes are hard to reason about from static settings alone.
- Support teams need a shared artifact when guiding customers through tradeoffs.
- A simulator can tighten shaping work without promising a full preview system too early.

## Good first scope

1. Show the rule that changed.
2. Estimate the classes of objects affected.
3. Explain what cannot be predicted yet.

## Notes for shaping

See the linked markdown brief on [saved views](https://example.com/internal/saved-views) as a reminder that we should keep the surface explanatory, not sprawling.

> The first version should clarify consequences, not model every edge case.

\`\`\`json
{
  "rule": "archive after 30 days",
  "estimatedObjectsAffected": 1842,
  "confidence": "medium"
}
\`\`\`
`,
    spaceId: spaceIds.storage,
    summary:
      "Brief shaping note for a retention-policy simulator that explains consequences before commitment.",
    title: "Policy simulator as a customer decision aid",
    type: "Strategy",
    updatedAt: "2026-03-28T10:10:00.000Z",
  },
  {
    createdAt: "2026-03-09T09:10:00.000Z",
    horizonId: horizonIds.product.now,
    id: documentIds.denseList,
    markdown: `# Dense list view

Serious use depends on a dense list, not just a card board. The list should privilege scan-ability, blockers, and linked context.

## Expected behavior

- Fast filter changes
- Compact metadata
- Quick jumps to linked strategy and evolution docs
`,
    spaceId: spaceIds.product,
    summary: "Why the dense list is a first-class execution view rather than a fallback.",
    title: "Dense list as a first-class work view",
    type: "Evolution",
    updatedAt: "2026-03-28T07:55:00.000Z",
  },
];

const workItems: WorkItemDTO[] = [
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-12T08:30:00.000Z",
    horizonId: horizonIds.platform.now,
    id: workItemIds.deploymentFreezeGuardrails,
    lastTouchedAt: "2026-03-27T16:40:00.000Z",
    ownerName: "Mikael",
    ownerUserIds: [userIds.mikael],
    ref: "ML-12",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.platform,
    state: "Active",
    summary: "Introduce lighter release guardrails for high-risk deploy windows.",
    targetEndDate: "2026-04-03",
    targetStartDate: "2026-03-24",
    title: "Introduce deployment freeze guardrails",
    type: "Change",
    updatedAt: "2026-03-27T16:40:00.000Z",
  },
  {
    blockedReason: "Waiting for a customer export sample that reproduces the timeout.",
    completedAt: null,
    createdAt: "2026-03-06T10:00:00.000Z",
    horizonId: horizonIds.iam.now,
    id: workItemIds.accessReviewExports,
    lastTouchedAt: "2026-03-20T09:15:00.000Z",
    ownerName: "Sara",
    ownerUserIds: [userIds.sara],
    ref: "ML-18",
    roadmapRelevance: true,
    source: "unplanned",
    spaceId: spaceIds.iam,
    state: "Blocked",
    summary: "Enterprise export runs can exceed practical timeout windows.",
    targetEndDate: "2026-03-31",
    targetStartDate: "2026-03-24",
    title: "Access review exports take hours for large tenants",
    type: "Problem",
    updatedAt: "2026-03-20T09:15:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-17T12:10:00.000Z",
    horizonId: horizonIds.storage.now,
    id: workItemIds.restoreAuditEvents,
    lastTouchedAt: "2026-03-25T15:05:00.000Z",
    ownerName: "Amina",
    ownerUserIds: [userIds.amina],
    ref: "ML-21",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.storage,
    state: "Ready",
    summary: "Cold-storage restores are missing some audit entries after replay.",
    targetEndDate: "2026-04-04",
    targetStartDate: "2026-03-25",
    title: "Cold storage restores skip audit trail events",
    type: "Bug",
    updatedAt: "2026-03-25T15:05:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-18T09:20:00.000Z",
    horizonId: horizonIds.product.next,
    id: workItemIds.savedViews,
    lastTouchedAt: "2026-03-28T08:20:00.000Z",
    ownerName: "Mikael",
    ownerUserIds: [userIds.mikael],
    ref: "ML-24",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.product,
    state: "Shaping",
    summary: "Reusable work perspectives should make common operational views faster to reach.",
    targetEndDate: "2026-04-10",
    targetStartDate: "2026-04-01",
    title: "Offer saved work views for triage and blockers",
    type: "Idea",
    updatedAt: "2026-03-28T08:20:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: "2026-03-25T12:05:00.000Z",
    createdAt: "2026-03-11T11:35:00.000Z",
    horizonId: horizonIds.platform.now,
    id: workItemIds.webhookRetryNoise,
    lastTouchedAt: "2026-03-25T12:05:00.000Z",
    ownerName: "Lea",
    ownerUserIds: [userIds.lea],
    ref: "ML-27",
    roadmapRelevance: false,
    source: "unplanned",
    spaceId: spaceIds.platform,
    state: "Done",
    summary: "Retry storms made alert loops look worse than the underlying failure rate.",
    targetEndDate: "2026-03-25",
    targetStartDate: "2026-03-20",
    title: "Trim webhook retry noise in alert loop",
    type: "Task",
    updatedAt: "2026-03-25T12:05:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-13T08:50:00.000Z",
    horizonId: horizonIds.iam.next,
    id: workItemIds.tokenRevocationModel,
    lastTouchedAt: "2026-03-26T13:45:00.000Z",
    ownerName: "Sara",
    ownerUserIds: [userIds.sara],
    ref: "ML-29",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.iam,
    state: "Shaping",
    summary:
      "We need a clear machine-user token revocation model before shipping automation controls.",
    targetEndDate: "2026-04-02",
    targetStartDate: "2026-03-27",
    title: "Choose token revocation model for machine users",
    type: "Decision request",
    updatedAt: "2026-03-26T13:45:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-15T10:25:00.000Z",
    horizonId: horizonIds.storage.next,
    id: workItemIds.resumableCopy,
    lastTouchedAt: "2026-03-26T09:30:00.000Z",
    ownerName: "Amina",
    ownerUserIds: [userIds.amina],
    ref: "ML-31",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.storage,
    state: "Ready",
    summary: "Make large-object copy more resilient for long-running transfers.",
    targetEndDate: "2026-04-14",
    targetStartDate: "2026-04-02",
    title: "Ship resumable multipart upload copy",
    type: "Change",
    updatedAt: "2026-03-26T09:30:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-27T06:45:00.000Z",
    horizonId: horizonIds.platform.now,
    id: workItemIds.buildAgentLogs,
    lastTouchedAt: "2026-03-27T06:45:00.000Z",
    ownerName: null,
    ownerUserIds: [],
    ref: "ML-33",
    roadmapRelevance: false,
    source: "unplanned",
    spaceId: spaceIds.platform,
    state: "Inbox",
    summary: "Operators lose container-startup logs after agent restarts.",
    targetEndDate: "2026-04-05",
    targetStartDate: "2026-03-27",
    title: "Build agent logs disappear after container restart",
    type: "Bug",
    updatedAt: "2026-03-27T06:45:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-14T09:10:00.000Z",
    horizonId: horizonIds.product.next,
    id: workItemIds.strategyTraceability,
    lastTouchedAt: "2026-03-28T09:40:00.000Z",
    ownerName: "Mikael",
    ownerUserIds: [userIds.mikael, userIds.lea],
    ref: "ML-34",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.product,
    state: "Active",
    summary:
      "Roadmap-relevant work still needs clearer traceability back to strategy and evolution docs.",
    targetEndDate: "2026-04-06",
    targetStartDate: "2026-03-24",
    title: "Roadmap lacks explicit strategy-to-execution traceability",
    type: "Problem",
    updatedAt: "2026-03-28T09:40:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-02-24T11:00:00.000Z",
    horizonId: horizonIds.iam.later,
    id: workItemIds.breakGlassDoc,
    lastTouchedAt: "2026-02-24T11:00:00.000Z",
    ownerName: "Jonas",
    ownerUserIds: [userIds.jonas],
    ref: "ML-36",
    roadmapRelevance: false,
    source: "planned",
    spaceId: spaceIds.iam,
    state: "Parked",
    summary: "Needs a clearer durable note before it is worth pulling forward.",
    targetEndDate: null,
    targetStartDate: null,
    title: "Document elevated access break-glass path",
    type: "Task",
    updatedAt: "2026-02-24T11:00:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-04T15:15:00.000Z",
    horizonId: horizonIds.storage.later,
    id: workItemIds.policySimulator,
    lastTouchedAt: "2026-03-12T13:00:00.000Z",
    ownerName: null,
    ownerUserIds: [],
    ref: "ML-40",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.storage,
    state: "Shaping",
    summary: "Could help customers understand retention effects before committing changes.",
    targetEndDate: null,
    targetStartDate: null,
    title: "Policy simulator for retention rules",
    type: "Idea",
    updatedAt: "2026-03-12T13:00:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-02-10T10:05:00.000Z",
    horizonId: horizonIds.platform.later,
    id: workItemIds.archiveDuplicates,
    lastTouchedAt: "2026-02-14T09:25:00.000Z",
    ownerName: null,
    ownerUserIds: [],
    ref: "ML-41",
    roadmapRelevance: false,
    source: "planned",
    spaceId: spaceIds.platform,
    state: "Archived",
    summary:
      "Duplicate follow-up items from a February incident review were archived after consolidation.",
    targetEndDate: null,
    targetStartDate: null,
    title: "Archive duplicate incident follow-ups from February",
    type: "Task",
    updatedAt: "2026-02-14T09:25:00.000Z",
  },
  {
    blockedReason: "Waiting for two team leads to agree on review prompts worth keeping.",
    completedAt: null,
    createdAt: "2026-03-16T14:30:00.000Z",
    horizonId: horizonIds.product.next,
    id: workItemIds.focusReviewTemplate,
    lastTouchedAt: "2026-03-21T10:20:00.000Z",
    ownerName: "Lea",
    ownerUserIds: [userIds.lea, userIds.mikael],
    ref: "ML-42",
    roadmapRelevance: false,
    source: "planned",
    spaceId: spaceIds.product,
    state: "Blocked",
    summary:
      "Review prompts should surface finish, slip, add, and drop without turning into ceremony.",
    targetEndDate: "2026-03-29",
    targetStartDate: "2026-03-25",
    title: "Refresh focus review template for slipped work",
    type: "Task",
    updatedAt: "2026-03-21T10:20:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-19T07:55:00.000Z",
    horizonId: horizonIds.iam.now,
    id: workItemIds.rotationEmailContext,
    lastTouchedAt: "2026-03-27T14:05:00.000Z",
    ownerName: "Jonas",
    ownerUserIds: [userIds.jonas],
    ref: "ML-43",
    roadmapRelevance: false,
    source: "unplanned",
    spaceId: spaceIds.iam,
    state: "Active",
    summary:
      "Notification emails need clearer space context when rotation applies to multiple token families.",
    targetEndDate: "2026-04-03",
    targetStartDate: "2026-03-26",
    title: "Service token rotation emails missing space context",
    type: "Bug",
    updatedAt: "2026-03-27T14:05:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-02T09:30:00.000Z",
    horizonId: horizonIds.storage.next,
    id: workItemIds.restoreTriageIntake,
    lastTouchedAt: "2026-03-09T09:30:00.000Z",
    ownerName: null,
    ownerUserIds: [],
    ref: "ML-45",
    roadmapRelevance: true,
    source: "unplanned",
    spaceId: spaceIds.storage,
    state: "Inbox",
    summary:
      "Restore-related requests are piling up without a clear smell test or parking behavior.",
    targetEndDate: null,
    targetStartDate: null,
    title: "Restore backlog intake is growing faster than triage",
    type: "Problem",
    updatedAt: "2026-03-09T09:30:00.000Z",
  },
  {
    blockedReason: "",
    completedAt: null,
    createdAt: "2026-03-20T10:45:00.000Z",
    horizonId: horizonIds.product.next,
    id: workItemIds.denseListLaunch,
    lastTouchedAt: "2026-03-28T07:55:00.000Z",
    ownerName: "Mikael",
    ownerUserIds: [userIds.mikael, userIds.sara],
    ref: "ML-46",
    roadmapRelevance: true,
    source: "planned",
    spaceId: spaceIds.product,
    state: "Ready",
    summary:
      "Make the dense list feel like the serious operational default, not a fallback from the board.",
    targetEndDate: "2026-04-06",
    targetStartDate: "2026-03-28",
    title: "Launch calm dense list work view",
    type: "Change",
    updatedAt: "2026-03-28T07:55:00.000Z",
  },
];

const documentLinks: DocumentLink[] = [
  {
    documentId: documentIds.accessReviewExports,
    documentSection: "Current pain",
    id: "w2B7cD9e",
    relation: "informed-by",
    workItemId: workItemIds.accessReviewExports,
  },
  {
    documentId: documentIds.savedViews,
    documentSection: "Good first cuts",
    id: "x5F1gH8j",
    relation: "shaped-by",
    workItemId: workItemIds.savedViews,
  },
  {
    documentId: documentIds.machineTokenRevocation,
    documentSection: "Questions to resolve",
    id: "y8K4mN2p",
    relation: "explores",
    workItemId: workItemIds.tokenRevocationModel,
  },
  {
    documentId: documentIds.restoreFlow,
    documentSection: "Needed changes",
    id: "z1Q7rS5t",
    relation: "explores",
    workItemId: workItemIds.restoreTriageIntake,
  },
  {
    documentId: documentIds.clarityWithoutCeremony,
    documentSection: "Implications",
    id: "A4U9vW3x",
    relation: "informed-by",
    workItemId: workItemIds.strategyTraceability,
  },
  {
    documentId: documentIds.denseList,
    documentSection: "Expected behavior",
    id: "B7Y2zC6d",
    relation: "derived-from",
    workItemId: workItemIds.denseListLaunch,
  },
  {
    documentId: documentIds.q2Reliability,
    documentSection: "Focus themes",
    id: "C1E5fG8h",
    relation: "informed-by",
    workItemId: workItemIds.deploymentFreezeGuardrails,
  },
  {
    documentId: documentIds.incidentReviewMemo,
    documentSection: "Template",
    id: "D4J9kL2m",
    relation: "informed-by",
    workItemId: workItemIds.buildAgentLogs,
  },
  {
    documentId: documentIds.policySimulatorBrief,
    documentSection: "Good first scope",
    id: "E7N3pR6s",
    relation: "explores",
    workItemId: workItemIds.policySimulator,
  },
];

const views: SavedView[] = [
  {
    accent: "#c25d3b",
    createdAt: "2026-03-18T10:00:00.000Z",
    description: "Surface work currently blocked on outside movement.",
    filters: {
      blocked: true,
      state: "Blocked",
    },
    id: "view_blocked_now",
    name: "Blocked now",
    scope: "Work",
    updatedAt: "2026-03-28T08:00:00.000Z",
  },
  {
    accent: "#6f7683",
    createdAt: "2026-03-18T10:00:00.000Z",
    description: "Review inbox items that have not yet passed a smell test.",
    filters: {
      state: "Inbox",
    },
    id: "view_inbox_triage",
    name: "Inbox triage",
    scope: "Work",
    updatedAt: "2026-03-28T08:00:00.000Z",
  },
  {
    accent: "#1d7b58",
    createdAt: "2026-03-18T10:00:00.000Z",
    description: "Show near-term work that is likely next once it becomes pullable.",
    filters: {
      horizonName: "Next",
    },
    id: "view_next_horizon",
    name: "Next horizon",
    scope: "Plan",
    updatedAt: "2026-03-28T08:00:00.000Z",
  },
  {
    accent: "#8a5b2b",
    createdAt: "2026-03-18T10:00:00.000Z",
    description: "Show operational work that is aging badly and likely needs a decision.",
    filters: {
      stale: true,
      state: "Active",
    },
    id: "view_stale_active",
    name: "Stale active work",
    scope: "Understand",
    updatedAt: "2026-03-28T08:00:00.000Z",
  },
];

const activity: ActivityEvent[] = [
  {
    action: "document.updated",
    createdAt: "2026-03-29T08:20:00.000Z",
    entityId: documentIds.incidentReviewMemo,
    entityType: "document",
    id: "F2T8uV5w",
    metadata: {
      title: "Incident review memo pattern",
    },
    summary:
      "Incident review memo pattern was added with a tighter operator checklist and command snippet.",
  },
  {
    action: "state.changed",
    createdAt: "2026-03-28T09:40:00.000Z",
    entityId: workItemIds.strategyTraceability,
    entityType: "work-item",
    id: "G5X1yZ4a",
    metadata: {
      nextState: "Active",
      previousState: "Shaping",
      ref: "ML-34",
    },
    summary:
      "ML-34 moved from Shaping to Active after the roadmap traceability slice was narrowed.",
  },
  {
    action: "document.updated",
    createdAt: "2026-03-28T08:55:00.000Z",
    entityId: documentIds.savedViews,
    entityType: "document",
    id: "H8B4cD7e",
    metadata: {
      title: "Saved views should stay light",
    },
    summary: "Saved views note was updated with a tighter first-cut list for Work and Understand.",
  },
  {
    action: "state.changed",
    createdAt: "2026-03-28T07:55:00.000Z",
    entityId: workItemIds.denseListLaunch,
    entityType: "work-item",
    id: "J1F6gH9k",
    metadata: {
      nextState: "Ready",
      previousState: "Shaping",
      ref: "ML-46",
    },
    summary: "ML-46 moved into Ready after the dense-list scope was clarified.",
  },
  {
    action: "state.changed",
    createdAt: "2026-03-27T16:40:00.000Z",
    entityId: workItemIds.deploymentFreezeGuardrails,
    entityType: "work-item",
    id: "K4L8mN2p",
    metadata: {
      ref: "ML-12",
    },
    summary: "ML-12 received fresh operator notes and remains Active.",
  },
  {
    action: "document.updated",
    createdAt: "2026-03-27T13:10:00.000Z",
    entityId: documentIds.accessReviewExports,
    entityType: "document",
    id: "M7Q3rS6t",
    metadata: {
      title: "Access review export evolution",
    },
    summary:
      "Access review export evolution added streaming-batch direction and clearer support signals.",
  },
  {
    action: "document.updated",
    createdAt: "2026-03-28T10:10:00.000Z",
    entityId: documentIds.policySimulatorBrief,
    entityType: "document",
    id: "N1U5vW8x",
    metadata: {
      title: "Policy simulator as a customer decision aid",
    },
    summary:
      "Policy simulator brief captured a smaller explanatory scope and example modeling payload.",
  },
  {
    action: "state.changed",
    createdAt: "2026-03-27T14:05:00.000Z",
    entityId: workItemIds.rotationEmailContext,
    entityType: "work-item",
    id: "P4Y9zC2d",
    metadata: {
      ref: "ML-43",
    },
    summary: "ML-43 stayed Active after copy and template changes were split into smaller slices.",
  },
  {
    action: "state.changed",
    createdAt: "2026-03-25T12:05:00.000Z",
    entityId: workItemIds.webhookRetryNoise,
    entityType: "work-item",
    id: "R7E3fG6h",
    metadata: {
      nextState: "Done",
      previousState: "Active",
      ref: "ML-27",
    },
    summary: "ML-27 completed and removed alert-loop retry noise from the operator path.",
  },
];

function createSeedUser(input: {
  email: string;
  id: string;
  name: string;
  role?: UserDTO["role"];
}) {
  return {
    activatedAt: "2026-02-10T09:00:00.000Z",
    createdAt: baseCreatedAt,
    email: input.email,
    id: input.id,
    invitedAt: baseCreatedAt,
    lastSignedInAt: "2026-03-28T09:00:00.000Z",
    name: input.name,
    permissions: {
      boards: {
        level: "editor",
        scope: "all",
      },
      documents: "editor",
      signals: "editor",
    },
    role: input.role ?? "User",
    status: "Active",
    updatedAt: "2026-03-28T09:00:00.000Z",
  } satisfies UserDTO;
}

/**
 * @description Return a cloned seed ledger so repositories can safely mutate local state.
 */
export function getSeedData(): SeedData {
  return structuredClone({
    activity,
    apiIdentities,
    documentLinks,
    documents,
    horizons,
    horizonDefaults,
    spaces,
    users,
    views,
    workItems,
  });
}
