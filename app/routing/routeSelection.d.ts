export interface RouteSelection {
  id?: string;
  routeKey?: string;
}

export interface RoutableRecord {
  id: string;
  ref?: string | null;
}

export function hasRouteSelection(selection: RouteSelection): boolean;
export function getRouteSelectionKey(
  items: RoutableRecord[] | null | undefined,
  selection: RouteSelection,
): string;
export function resolveRouteSelection(
  items: RoutableRecord[] | null | undefined,
  selection: RouteSelection,
): { id: string; routeKey: string };
