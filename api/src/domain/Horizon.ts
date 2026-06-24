import { ValidationError } from "../errors/MikroLensError.ts";

export type HorizonKey = "horizon_1" | "horizon_2" | "horizon_3";

/**
 * @description Organization-level default Horizon presentation shared across Spaces.
 */
export interface HorizonDefaultDTO {
  createdAt: string;
  description: string;
  key: HorizonKey;
  label: string;
  orderIndex: number;
  timeframeText: string;
  updatedAt: string;
}

/**
 * @description Effective Horizon settings for a single Space, optionally inherited from org defaults.
 */
export interface HorizonDTO {
  createdAt: string;
  description: string;
  descriptionOverride: string | null;
  id: string;
  inheritsDefault: boolean;
  key: HorizonKey;
  label: string;
  labelOverride: string | null;
  name: string;
  orderIndex: number;
  spaceId: string;
  timeframeText: string;
  timeframeTextOverride: string | null;
  updatedAt: string;
}

export const horizonKeys = ["horizon_1", "horizon_2", "horizon_3"] as const;
export const defaultHorizonKey: HorizonKey = "horizon_1";

export interface CreateHorizonDefaultInput {
  description?: string;
  key: HorizonKey;
  label?: string;
  now: string;
  timeframeText?: string;
}

export interface UpdateHorizonDefaultInput {
  description?: string;
  label?: string;
  now: string;
  timeframeText?: string;
}

export interface CreateHorizonInput {
  id: string;
  key: HorizonKey;
  now: string;
  spaceId: string;
}

export interface UpdateHorizonInput {
  description?: string;
  label?: string;
  now: string;
  timeframeText?: string;
  useDefaults?: boolean;
}

export class HorizonDefault {
  private readonly dto: HorizonDefaultDTO;

  private constructor(dto: HorizonDefaultDTO) {
    this.dto = dto;
  }

  static create(input: CreateHorizonDefaultInput): HorizonDefault {
    const now = requireText(input.now, "Horizon default timestamp is required.");
    const fallback = builtInHorizonDefinition(input.key);

    return new HorizonDefault({
      createdAt: now,
      description: normalizeNonEmptyText(input.description, fallback.description),
      key: input.key,
      label: normalizeNonEmptyText(input.label, fallback.label),
      orderIndex: fallback.orderIndex,
      timeframeText: normalizeNonEmptyText(input.timeframeText, fallback.timeframeText),
      updatedAt: now,
    });
  }

  static rehydrate(dto: HorizonDefaultDTO): HorizonDefault {
    return new HorizonDefault({ ...dto });
  }

  updateDetails(input: UpdateHorizonDefaultInput): HorizonDefault {
    return new HorizonDefault({
      ...this.dto,
      description: normalizeNonEmptyText(input.description, this.dto.description),
      label: normalizeNonEmptyText(input.label, this.dto.label),
      timeframeText: normalizeNonEmptyText(input.timeframeText, this.dto.timeframeText),
      updatedAt: requireText(input.now, "Horizon default timestamp is required."),
    });
  }

  toDTO(): HorizonDefaultDTO {
    return { ...this.dto };
  }
}

export class Horizon {
  private readonly dto: HorizonDTO;

  private constructor(dto: HorizonDTO) {
    this.dto = dto;
  }

  static create(input: CreateHorizonInput, defaults: HorizonDefaultDTO): Horizon {
    const now = requireText(input.now, "Horizon timestamp is required.");

    return new Horizon({
      createdAt: now,
      description: defaults.description,
      descriptionOverride: null,
      id: requireText(input.id, "Horizon id is required."),
      inheritsDefault: true,
      key: input.key,
      label: defaults.label,
      labelOverride: null,
      name: defaults.label,
      orderIndex: defaults.orderIndex,
      spaceId: requireText(input.spaceId, "Horizon space is required."),
      timeframeText: defaults.timeframeText,
      timeframeTextOverride: null,
      updatedAt: now,
    });
  }

  static rehydrate(dto: HorizonDTO): Horizon {
    return new Horizon({ ...dto });
  }

  updateDetails(input: UpdateHorizonInput, defaults: HorizonDefaultDTO): Horizon {
    const updatedAt = requireText(input.now, "Horizon timestamp is required.");
    const useDefaults = Boolean(input.useDefaults);
    const labelOverride = useDefaults
      ? null
      : resolveOverride(input.label, defaults.label, this.dto.labelOverride);
    const descriptionOverride = useDefaults
      ? null
      : resolveOverride(input.description, defaults.description, this.dto.descriptionOverride);
    const timeframeTextOverride = useDefaults
      ? null
      : resolveOverride(
          input.timeframeText,
          defaults.timeframeText,
          this.dto.timeframeTextOverride,
        );
    const label = labelOverride ?? defaults.label;
    const description = descriptionOverride ?? defaults.description;
    const timeframeText = timeframeTextOverride ?? defaults.timeframeText;

    return new Horizon({
      ...this.dto,
      description,
      descriptionOverride,
      inheritsDefault: !labelOverride && !descriptionOverride && !timeframeTextOverride,
      label,
      labelOverride,
      name: label,
      timeframeText,
      timeframeTextOverride,
      updatedAt,
    });
  }

  toDTO(): HorizonDTO {
    return { ...this.dto };
  }
}

/**
 * @description Narrow a free-form string to a valid horizon key.
 */
export function isHorizonKey(value: string): value is HorizonKey {
  return horizonKeys.includes(value as HorizonKey);
}

export function orderIndexForHorizonKey(key: HorizonKey): number {
  return builtInHorizonDefinition(key).orderIndex;
}

export function builtInHorizonDefinition(
  key: HorizonKey,
): Pick<HorizonDefaultDTO, "description" | "label" | "orderIndex" | "timeframeText"> {
  return {
    horizon_1: {
      description: "Immediate work and current planning focus.",
      label: "Now",
      orderIndex: 0,
      timeframeText: "Current work and near-term pull decisions.",
    },
    horizon_2: {
      description: "Upcoming work that should stay visible but is not active yet.",
      label: "Next",
      orderIndex: 1,
      timeframeText: "Likely next work once ready enough to pull.",
    },
    horizon_3: {
      description: "Longer-range ideas and commitments that are not ready to pull forward.",
      label: "Later",
      orderIndex: 2,
      timeframeText: "Longer-horizon bets and preserved candidates.",
    },
  }[key];
}

export function getBuiltInHorizonDefaults(now = new Date().toISOString()): HorizonDefaultDTO[] {
  return horizonKeys.map((key) =>
    HorizonDefault.create({
      ...builtInHorizonDefinition(key),
      key,
      now,
    }).toDTO(),
  );
}

function normalizeNonEmptyText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
}

function resolveOverride(
  value: string | undefined,
  defaultValue: string,
  existingOverride: string | null,
): string | null {
  const trimmed = value?.trim();
  const candidate =
    trimmed === undefined ? (existingOverride ?? defaultValue) : trimmed || defaultValue;

  return candidate === defaultValue ? null : candidate;
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(message);
  }

  return trimmed;
}
