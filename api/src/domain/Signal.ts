import { ValidationError } from "../errors/MikroLensError.ts";
import type { SpaceDTO } from "./Space.ts";

export type SignalUrgency = "Low" | "Medium" | "High";
export type SignalStatus = "Open" | "Pulled";

/**
 * @description A lightweight global intake record that can later be pulled into a Space.
 * The summary intentionally stays free-form so respondents can include customer, source, impact,
 * and outcome clues without expanding the core intake model.
 */
export interface SignalDTO {
  id: string;
  ref: string;
  title: string;
  summary: string;
  source: string;
  urgency: SignalUrgency;
  expectedTimeline: string | null;
  status: SignalStatus;
  createdAt: string;
  updatedAt: string;
  pulledAt: string | null;
  pulledIntoWorkItemId: string | null;
}

const DEFAULT_SUMMARY =
  "Captured without extra ceremony. Add customer, source, impact, or outcome clues before pulling it into a space if they are known.";
export const signalUrgencies = ["Low", "Medium", "High"] as const;
export const signalStatuses = ["Open", "Pulled"] as const;

/**
 * @description Enriched signal payload returned by the API.
 */
export interface SignalRecord extends SignalDTO {
  ageDays: number;
  isStale: boolean;
  pulledIntoSpace: SpaceDTO | null;
  pulledIntoWorkItemRef: string | null;
}

export interface CreateSignalInput {
  expectedTimeline?: string | null;
  id: string;
  now: string;
  ref: string;
  source: string;
  summary?: string;
  title: string;
  urgency?: SignalUrgency | null;
}

export interface UpdateSignalDetailsInput {
  expectedTimeline?: string | null;
  now: string;
  source?: string;
  summary?: string;
  title?: string;
  urgency?: SignalUrgency;
}

export class Signal {
  private readonly dto: SignalDTO;

  private constructor(dto: SignalDTO) {
    this.dto = dto;
  }

  static create(input: CreateSignalInput): Signal {
    const now = requireText(input.now, "Signal timestamp is required.");

    return new Signal({
      createdAt: now,
      expectedTimeline: normalizeNullableText(input.expectedTimeline),
      id: requireText(input.id, "Signal id is required."),
      pulledAt: null,
      pulledIntoWorkItemId: null,
      ref: requireText(input.ref, "Signal reference is required."),
      status: "Open",
      source: requireText(input.source, "Signal author is required."),
      summary: input.summary?.trim() || DEFAULT_SUMMARY,
      title: requireText(input.title, "Signal title is required."),
      updatedAt: now,
      urgency: input.urgency ?? "Medium",
    });
  }

  static rehydrate(dto: SignalDTO): Signal {
    return new Signal({ ...dto });
  }

  updateDetails(input: UpdateSignalDetailsInput): Signal {
    return new Signal({
      ...this.dto,
      expectedTimeline:
        input.expectedTimeline === undefined
          ? this.dto.expectedTimeline
          : normalizeNullableText(input.expectedTimeline),
      source: input.source?.trim() || this.dto.source,
      summary: input.summary?.trim() || this.dto.summary,
      title: input.title?.trim() || this.dto.title,
      updatedAt: requireText(input.now, "Signal timestamp is required."),
      urgency: input.urgency ?? this.dto.urgency,
    });
  }

  markPulled(now: string, workItemId: string): Signal {
    if (this.dto.status === "Pulled") {
      throw new ValidationError("Signal has already been pulled.");
    }

    const timestamp = requireText(now, "Signal timestamp is required.");

    return new Signal({
      ...this.dto,
      pulledAt: timestamp,
      pulledIntoWorkItemId: requireText(workItemId, "Pulled work item id is required."),
      status: "Pulled",
      updatedAt: timestamp,
    });
  }

  reopen(now: string): Signal {
    const timestamp = requireText(now, "Signal timestamp is required.");

    return new Signal({
      ...this.dto,
      pulledAt: null,
      pulledIntoWorkItemId: null,
      status: "Open",
      updatedAt: timestamp,
    });
  }

  toDTO(): SignalDTO {
    return { ...this.dto };
  }
}

/**
 * @description Narrow a free-form string to a valid signal urgency.
 */
export function isSignalUrgency(value: string): value is SignalUrgency {
  return signalUrgencies.includes(value as SignalUrgency);
}

function normalizeNullableText(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(message);
  }

  return trimmed;
}
