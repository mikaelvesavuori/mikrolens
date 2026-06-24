# MikroLens product spec

## 1. Purpose

**Calm. Clear. No theater.**

MikroLens is a calm, self-hostable work system for product and engineering teams that want clarity without bureaucracy.

Successful products are built by empowering teams and providing direction—not by micro-managing their work. The output of teams, when in line with strategy, is the key work output, not the theater of work management and ticket-pushing.

MikroLens is not intended to be a better Jira by copying Jira. It is intended to replace bloated, process-heavy work-management tools with a leaner system that helps teams:

* understand what matters
* decide what to do
* plan with appropriate fidelity
* execute without ritual overhead
* preserve useful context and history

MikroLens should support good working patterns associated with ideas from sources such as *Accelerate* and *Making Work Visible*, but without descending into becoming a performance-monitoring or micro-management tool.

The product should optimize for:

* autonomy
* small-batch, comprehensible work
* fast feedback
* low ceremony
* visible flow and blockers
* healthy intake and backlog hygiene
* portability and self-hostability
* durable decision records

It should explicitly avoid becoming:

* a management surveillance system
* a reporting-first PM cockpit
* a giant configurable workflow engine
* a pseudo-scientific planning machine
* a guilt-inducing infinite backlog

---

## 2. Product positioning

MikroLens is best understood as a **self-hosted work ledger for product and engineering teams**.

Its core differentiation is:

* calm and minimal rather than bloated
* anti-bureaucratic by design
* the ability to be "all in one": document-capable rather than ticket-only
* planning-aware rather than planning-dominated
* sovereignty-friendly rather than SaaS-lock-in oriented

It should be especially compelling for teams that:

* dislike Jira-style administrative overhead
* need more structure than e.g. Trello or GitHub Issues alone
* want linked decisions, plans, and execution in one system
* care about self-hosting, portability, or long-term control
* want to work seriously without importing heavyweight enterprise process

---

## 3. Core design principles

### 3.1 Legibility over bureaucracy

The system should make work, intent, and change legible without requiring excessive process.

### 3.2 Narrative and operational truth must coexist

MikroLens should support both compact work records and richer narrative documents. These should be linked, not isolated.

### 3.3 Planning should stay lighter than execution

The farther into the future the view, the lighter and more narrative the planning should be.

### 3.4 Workflow state, planning horizon, focus, and target dates are distinct concepts

These must not be collapsed into one another.

* **Workflow state** answers: what is happening to this right now?
* **Horizon** answers: when is this relevant?
* **In focus** answers: have we explicitly selected this as part of the current working set?
* **Target dates** answer: when are we aiming to start or finish this?

### 3.5 Default to system understanding, not individual surveillance

MikroLens should help teams understand flow, friction, staleness, blocked work, and intake health. It should not default to measuring or ranking individuals. Aggregated analytics or stats make sense, but not on the individual level.

### 3.6 Decay and reaffirmation are first-class behaviors

The system should resist immortal backlog growth by making stale, untouched, or untriaged work visible and easy to archive, park, or reaffirm.

### 3.7 Strong opinions, limited configuration

MikroLens should be flexible where it matters, but it should resist becoming infinitely configurable. Over-configuration leads to bureaucracy.

---

## 4. Mental model

MikroLens supports four top-level kinds of work activity:

1. **Understand** — understand what is happening in the work system
2. **Direct** — define direction, strategy, and durable reasoning
3. **Plan** — place work and intentions across planning horizons
4. **Work** — handle daily operational execution

These are the primary navigation areas and the main information architecture of the product.

---

## 5. Top-level navigation

Primary navigation should be:

* Understand
* Direct
* Plan
* Work
* Settings

Space selection should be globally accessible.

The product should make it easy to move between:

* a global, cross-space view
* a single-space view
* saved views and filters

A user should be able to understand whether they are currently looking at:

* all spaces
* a specific space
* a filtered or saved view
* a current focus or planning view

---

## 6. Main object types

The product needs only a small number of core objects at the product level.

### 6.1 Work Item

A compact operational record representing a unit of work, concern, change, or candidate action.

Examples of Work Item types:

* Idea
* Problem
* Bug
* Task
* Change
* Decision request

A Work Item should be optimized for:

* fast capture
* ability to hold low- to medium amount of context/information
* quick scanning in lists and boards
* visible operational state
* linkage to documents, horizons, focus/target-date intent, and related items

### 6.2 Document

A richer, narrative object used for deeper reasoning and durable records.

Examples of Document types:

* Strategy
* Evolution
* Idea / Note
* Decision (e.g. ADR)
* Release note
* Postmortem

Documents should support markdown authoring and clean reading/presentation.

### 6.3 Space

A domain, team, product area, or work context.

Examples:

* IAM
* Storage
* Platform
* Product
* Infra

A Space is the primary organizational container for work.

### 6.4 Horizon

A planning bucket indicating temporal relevance.

Examples:

* Now
* Next
* Later

Horizons may be configurable per space, but should remain conceptually simple.

### 6.5 Focus

An optional explicit signal that a work item is part of the current selected working set.

Examples:

* In focus = true
* explicitly selected for this week
* pulled into active planning attention

Focus is lightweight selection intent, not a workflow state.

### 6.6 View

A saved perspective on work, planning, or system understanding.

Examples:

* Current work
* Blocked now
* Stale items
* In focus
* Next horizon
* Inbox triage

Views should not become a separate ontology. They are perspectives, not new object types.

---

## 7. Object relationships

The product should support simple linking between objects, but without requiring a complex graph mental model.

Examples of important relationships:

* a Problem Work Item can point to an Evolution document
* a Strategy document can inform one or more Horizons
* an Evolution document can produce one or more Change or Task Work Items
* a Work Item can link to a specific section of a Document
* a roadmap-relevant item can appear in Plan while still being executed in Work

The key rule is:

* compact records and richer documents should coexist and link cleanly
* a compact record should not be destructively mutated into a document type

For example:

* a Problem remains a Problem
* a linked Evolution document can be created from it
* the two then coexist and reference each other

---

## 8. Workflow states

Workflow state answers: **what is happening to this right now?**

This is the operational truth of the system and should remain stable across the product.

Recommended core states:

* Inbox
* Shaping
* Ready
* Active
* Waiting
* Done
* Parked
* Archived

### State meanings

**Inbox**
New, incoming, unsorted, or uncommitted work.

**Shaping**
Being explored, clarified, or defined. Worth understanding better, but not yet ready for near-term execution.

**Ready**
Clear enough to be pulled into near-term work responsibly.

**Active**
Currently being worked.

**Waiting**
Not progressing because something external or unresolved is needed.

**Done**
Completed as work.

**Parked**
Intentionally retained, but not being pursued now.

**Archived**
No longer active or relevant enough to keep alive operationally.

### Important rule

Workflow state must not be confused with Horizon, focus, or target dates.

* Ready and Done are states
* Now / Next / Later are horizons
* In focus is explicit selection intent
* Target start / end dates are scheduling intent

---

## 9. Intake, unsorted work, and ideas

MikroLens should explicitly avoid a traditional giant “backlog” as its primary intake pattern.

Instead, it should use a healthier flow:

* Inbox
* Shaping
* Ready
* Active
* Done / Parked / Archived

### Inbox

Inbox is where incoming, new, unsorted, or uncommitted things go.

Examples:

* ideas
* requests
* complaints
* bugs
* opportunities
* vague concerns
* notes that may matter later

Inbox is not commitment and not a plan.

### Signals as evidence-aware intake

Signals should remain lightweight and should not become a separate customer-feedback database.
However, the capture experience should gently nudge respondents to include the facts a product team
needs for later judgment:

* who is affected: customer, account, segment, internal team, or role
* where the signal came from: conversation, support ticket, sales note, observation, link, or quote
* what the impact seems to be: pain, frequency, revenue, renewal risk, workaround, or opportunity size
* when it matters: now, renewal, launch window, seasonal event, or "no known deadline"
* what a good outcome would look like

These details should live in the existing free-text Signal summary and supporting linked
documents when needed. Do not add customer/account hierarchy or request-specific schema until the
product has clear evidence that the extra structure is worth the ceremony.

### Shaping

Shaping is where something has passed an initial smell test and is worth clarifying further.

Examples:

* a Problem being explored
* an Idea under consideration
* a candidate feature being framed
* a bug cluster being understood

### Parked

Parked is for things that may matter later, but should not pollute current planning.

### Archived

Archived is for dead, obsolete, dropped, duplicate, or no-longer-relevant work.

### Decay behavior

MikroLens should support hygiene behaviors such as:

* surfacing Inbox items that have not been triaged for a set period
* surfacing Shaping items that have gone stale
* surfacing Parked items for periodic reaffirmation or archival
* auto-archiving long-untouched items when appropriate

---

## 10. Planning model

Planning in MikroLens should support at least three horizons of thought:

### 10.1 Current work

What is being handled now or immediately.

### 10.2 Near-term planning

What is likely to be taken on next, once ready enough.

### 10.3 Longer-term direction

What themes, bets, or capabilities matter over a longer horizon.

These should not be collapsed into a single infinite backlog.

---

## 11. Horizons

Horizons answer: **when is this relevant?**

Default horizons should be:

* Now
* Next
* Later

These should be configurable per space with sane defaults, such as:

* Now = current 2 weeks
* Next = next 2 months
* Later = next 12 months

But exact dates should remain optional.

### Horizon principles

* Horizons are planning buckets, not workflow columns
* Horizons may be semantic and/or date-informed
* Horizons may be remapped visually in views, but there should be a canonical space-level interpretation
* Horizons should stay simple and comprehensible

Examples:

* Problem / Shaping / Next
* Change / Ready / Now
* Idea / Parked / Later

---

## 12. Focus and target dates

Focus answers: **is this in the currently selected working set?**

Target dates answer: **when are we aiming to start or finish this?**

These should remain lightweight and optional.

They are best understood as:

* explicit selection intent on a work item
* lightweight support for daily prioritization
* simple scheduling information for timelines and review

Examples:

* In focus
* Target start = Apr 1
* Target end = Apr 14

### What focus should do

Focus should:

* hold a selected current working set
* support filtering/grouping in Work and Plan
* make current intent visible without creating another workflow
* support lightweight review of what stayed in focus and what slipped

### What target dates should do

Target dates should:

* support timeline and calendar views
* support lightweight review of work that slipped past its target
* remain optional intent, not mandatory scheduling bureaucracy

### What focus and target dates should not do

They should not become:

* replacements for workflow states
* mandatory fields for all work
* performance accounting tools
* heavy project scheduling systems

### Important rule

Focus should not be used as the left-to-right columns of daily work boards.

Focus and target dates are planning signals, not operational statuses.

---

## 13. Top-level view specifications

## 13.1 Understand

### Purpose

Understand helps users notice and interpret what is happening in the work system.

It should support systemic understanding rather than individual performance monitoring.

### Questions it should answer

* What has materially changed recently?
* What became blocked, stale, risky, or urgent?
* Where is work aging badly?
* How healthy is intake and triage?
* How much unplanned work is entering the system?
* Where is work waiting or carrying over?

### Typical content

* recent meaningful changes
* critical status changes
* stale items
* auto-archived items
* age / resolution / wait-time distributions
* planned vs unplanned work mix
* inbox triage debt
* unassigned or uncategorized items
* slipped or past-target work
* blocked work summaries

### Guardrails

Understand must not default to:

* individual rankings
* per-person output scoring
* management surveillance dashboards
* pseudo-objective productivity scoring

It is a system understanding view, not a people judgment view.

---

## 13.2 Direct

### Purpose

Direct is the strategy, reasoning, and durable intent layer.

It should support writing, reading, linking, and using documents that define why work matters and how direction is formed.

### Document types

At minimum:

* Strategy
* Evolution
* Idea / Note

Potentially later:

* ADR
* Release note
* Postmortem

### Characteristics

* markdown-first or markdown-compatible
* attractive reading view
* easy linking to Work Items, Horizons, Cycles, and roadmap-relevant objects
* ability to create a document from a Work Item context

### Important behavior

Compact records and documents should be linked, not collapsed together.

Example:

* a Problem Work Item may lead to a new Evolution document
* the Problem remains as its original operational signal
* the Evolution document becomes the richer narrative exploration

Direct should be one of the strongest differentiators of MikroLens.

### Strategy instead of hierarchy theater

MikroLens should not introduce separate Outcome, Initiative, Bet, Opportunity, or Theme objects just
because other product tools have hierarchy layers. Strategy and Evolution documents should carry that
reasoning first. If a team needs an outcome, initiative, bet, or opportunity, it should be expressed
as durable narrative linked to real work rather than as another required level in a tree.

The product should nudge users to connect work to strategies by making those document links easy,
visible, and useful. The answer is stronger linkage and better prompts, not necessarily more object
types.

---

## 13.3 Plan

### Purpose

Plan supports tactical and roadmap planning across one or many spaces.

It should show direction, likely sequencing, and roadmap placement without becoming a giant Gantt machine.

### Core structure

* horizontal axis = Horizons / time bands
* vertical axis = Spaces and/or Themes

### Included content

Plan may display:

* roadmap-relevant Work Items
* Evolutions
* Strategies or linked Themes/Bets
* Milestones where useful
* computed or curated planning placements

### Plan principles

* planning should remain lighter than execution
* future horizons should be more narrative and less precise
* exact dates should be optional
* roadmap views should be derivable from real work and documents where possible
* a cross-space roadmap should be available
* customer and evidence context should usually travel through Signals and linked documents rather
  than becoming default roadmap metadata

### Roadmap modes

Two roadmap modes are useful:

**Computed roadmap**
Derived from actual objects, Horizons, Cycles, and roadmap relevance.

**Curated roadmap**
A manually selected or simplified narrative roadmap for communication.

### Example visual forms

* all-spaces roadmap with Spaces as rows and Horizons as columns
* single-space roadmap
* grouped by Theme
* custom horizon visualizations for selected views

---

## 13.4 Work

### Purpose

Work is the daily operational execution layer.

It should help users understand what is being handled now and move work through the system with minimal ceremony.

### Core structure

The left-to-right segmentation of Work should be **workflow state**, not Cycles.

Recommended column model:

* Inbox
* Shaping
* Ready
* Active
* Waiting
* Done

Parked and Archived may be visible in dedicated views rather than always on the main board.

### Important rule

Focus should not replace workflow columns.

Instead, focus and target dates may:

* filter the Work view
* group records
* highlight the current working set
* support review of current and next planned work

### Work view forms

Work should support at least:

* board view
* dense list view

List view is especially important for serious use and should not be treated as secondary.

### Common filters

* Space
* owner / steward
* state
* type
* Horizon
* in focus
* target date
* blocked / waiting
* stale
* linked document / strategy / evolution

### Typical sub-views

* all current work
* in focus
* next horizon candidates
* blocked now
* stale active work
* inbox triage
* my work
* team work

---

## 14. Promotion / derivation behavior

Where richer reasoning is needed, MikroLens should allow a compact Work Item to spawn a richer Document.

This should be treated as a workflow action, not a destructive type conversion.

### Example

A Problem Work Item may be used to create an Evolution document.

The result is:

* the original Problem remains as a Work Item
* a new Evolution document is created and linked
* selected context is prefilled into the document
* the Work Item may move from Inbox/Shaping to an appropriate state such as Shaping or Being explored (if such language is later added)

The key point is:

* Work Item and Document remain distinct entities at the product level
* chronology and traceability are preserved

---

## 15. What MikroLens should optimize for in practice

MikroLens should make it easier for teams to:

* capture work without overcommitting to it
* distinguish intake from genuine planning
* shape work before starting it
* keep current work visible
* expose blockers and waiting work
* finish work rather than endlessly start more
* keep roadmap and execution linked
* preserve reasoning and context
* understand systemic friction and staleness
* archive or park dead work rather than hoard it forever

---

## 16. What MikroLens should deliberately avoid

The product should not optimize for:

* individual productivity surveillance
* leaderboards or ranking people by output
* giant custom workflow engines
* field explosion and form-heavy intake
* immortal backlog growth
* story-point religion
* velocity theatre
* hierarchy theater that duplicates strategy documents with extra object types
* burndown obsession
* forcing all work into formal planning windows
* making planning more important than actual work
* requiring duplicated updates across tickets, docs, and roadmaps

These are failure modes, not missing features.

---

## 17. Product language and framing

Recommended internal and external framing:

* MikroLens is a calm, self-hosted work system
* It is a work ledger for product and engineering teams
* It combines direction, planning, execution, and understanding
* It is meant to reduce overhead, not digitize bureaucracy

Useful conceptual sequence:

* Understand
* Direct
* Plan
* Work

Useful lifecycle sequence:

* intake something
* shape it
* make it ready
* pull it into current work
* complete it, park it, or archive it
* preserve useful reasoning and history along the way

---

## 18. Summary of the agreed structure

### Core navigation

* Understand
* Direct
* Plan
* Work

### Core objects

* Work Item
* Document
* Space
* Horizon
* View

### Core Work Item types

* Idea
* Problem
* Bug
* Task
* Change
* Decision request

### Core Document types

* Strategy
* Evolution
* Idea / Note
* optionally later ADR / Release note / Postmortem

### Core workflow states

* Inbox
* Shaping
* Ready
* Active
* Waiting
* Done
* Parked
* Archived

### Default Horizons

* Now
* Next
* Later

### Focus role

* optional explicit current working-set signal on work items
* supports grouping, filtering, and review
* does not replace workflow columns

### Plan role

* roadmap and planning view across one or more spaces
* Horizons horizontally, Spaces or Themes vertically
* supports computed and curated roadmap views

### Work role

* daily operational execution
* workflow columns horizontally
* board and dense list views
* filters by Space, state, owner, type, Horizon, focus, and more

### Understand role

* system and flow understanding
* change, staleness, friction, intake, slipped work, planned vs unplanned work
* not an individual performance dashboard

### Direct role

* strategy and durable reasoning
* markdown documents
* linked cleanly to work and planning

---

## 19. Instruction to implementation agents

When generating designs, product flows, or implementation plans from this spec, preserve these rules:

1. Do not collapse workflow state, Horizon, focus, and target dates into one concept.
2. Do not turn focus into board columns.
3. Do not make backlog-like accumulation the default intake model.
4. Keep documents and compact work records linked but distinct.
5. Prefer strong defaults over excessive configurability.
6. Keep planning lighter and less precise than execution.
7. Preserve anti-bureaucratic intent in all major features.
8. Default to system understanding rather than individual surveillance.
9. Support cross-space roadmap computation, but keep it grounded in real objects.
10. Keep Signals evidence-aware through prompts and free text rather than expanding the core model.
11. Treat strategy and evolution documents as the primary place for outcome, initiative, bet, and decision reasoning.
12. Maintain a calm, minimal, serious UX rather than a dashboard-heavy SaaS aesthetic.

This spec describes the intended product direction, design language, structure, and conceptual model for MikroLens. Technical architecture, persistence, APIs, and implementation detail are intentionally left unspecified.

---

## 20. Technical direction

* Split MikroLens into an API (backend) and app (frontend)
* Use Typescript for the API; use Biome for linting and Vitest for tests
* Use modern vanilla JS, HTML and CSS for the app
* Write comprehensive and useful tests for anything on the API
* Use a clean, minimalist, but humane and useful UI design aligned with the MikroSuite apps
* Use a modern system font stack consistent with MikroDocs, MikroForms, and MikroSheets
* Use CSS variables throughout the app to have a MikroSuite-style design token system: 8px radii, quiet surfaces, clear borders, and a restrained blue accent
* Use a lightweight clean architecture/DDD architecture; see the phaset-api project on disk as reference
* Do not install and use dependencies unless I've made them
* Choose between Node.js-native sqlite and my PikoDB file-based database; make sure the table design will work even for larger users, e.g. hundreds of Spaces and lots of data
* The application will be single-tenant and sold as a perpetual license; scale as needed with that fact
* While not part of the design docs (above), we will want to offer moder and strong API and automation support; that also means having a full OpenAPI 3.x schema available
* Ensure we use good and non-redundant JSDoc descriptions to describe any meaningful details (no need for types/params etc. as TS already covers that)
