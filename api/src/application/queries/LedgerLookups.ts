import type { HorizonDTO } from "../../domain/Horizon.ts";
import type { SpaceDTO } from "../../domain/Space.ts";

/**
 * @description Find a single Space by id for request validation.
 */
export function findSpace(spaces: SpaceDTO[], spaceId: string): SpaceDTO | null {
  return spaces.find((space) => space.id === spaceId) ?? null;
}

/**
 * @description Find a single Horizon by id for request validation.
 */
export function findHorizon(horizons: HorizonDTO[], horizonId: string): HorizonDTO | null {
  return horizons.find((horizon) => horizon.id === horizonId) ?? null;
}
