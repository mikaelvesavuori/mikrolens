export interface EvolutionDocument {
  horizonKey?: string | null;
  horizonName?: string | null;
  id: string;
  spaceName?: string | null;
  title: string;
  type?: string;
  [key: string]: unknown;
}

export interface EvolutionWorkItem {
  id: string;
  linkedDocuments?: EvolutionDocument[];
  [key: string]: unknown;
}

export interface EvolutionGroup {
  document: EvolutionDocument | null;
  id: string;
  items: EvolutionWorkItem[];
  kind: "evolution" | "standalone";
}

export function getEvolutionDocuments(workItem: EvolutionWorkItem): EvolutionDocument[];
export function getPrimaryEvolutionDocument(workItem: EvolutionWorkItem): EvolutionDocument | null;
export function getWorkItemsGroupedByEvolution(
  items: EvolutionWorkItem[],
  sortItems?: (entries: EvolutionWorkItem[]) => EvolutionWorkItem[],
): EvolutionGroup[];
export function sortEvolutionDocuments(left: EvolutionDocument, right: EvolutionDocument): number;
