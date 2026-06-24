import type { DocumentSummary } from "../../domain/Document.ts";
import type { HorizonDTO } from "../../domain/Horizon.ts";
import type { SpaceDTO } from "../../domain/Space.ts";
import type { WorkItemRecord } from "../../domain/WorkItem.ts";

/**
 * @description A computed roadmap cell for a given Space and Horizon.
 */
export interface PlanCell {
  horizon: HorizonDTO;
  workItems: WorkItemRecord[];
  documents: DocumentSummary[];
}

/**
 * @description The computed roadmap row for a single Space.
 */
export interface PlanLane {
  space: SpaceDTO;
  cells: PlanCell[];
}

/**
 * @description The payload returned by the planning view.
 */
export interface PlanSnapshot {
  computed: PlanLane[];
  horizons: Array<HorizonDTO["label"]>;
}
