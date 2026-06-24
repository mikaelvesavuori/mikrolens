import { ValidationError } from "../errors/MikroLensError.ts";

/**
 * @description The organizational home for work, documents, and planning data.
 */
export interface SpaceDTO {
  id: string;
  name: string;
  description: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_ACCENT = "#1665d8";

export interface CreateSpaceInput {
  accent?: string;
  description?: string;
  id: string;
  name: string;
  now: string;
}

export interface UpdateSpaceDetailsInput {
  accent?: string;
  description?: string;
  name?: string;
  now: string;
}

export class Space {
  private readonly dto: SpaceDTO;

  private constructor(dto: SpaceDTO) {
    this.dto = dto;
  }

  static create(input: CreateSpaceInput): Space {
    const now = requireText(input.now, "Space timestamp is required.");
    const name = requireText(input.name, "Space name is required.");

    return new Space({
      accent: input.accent?.trim() || DEFAULT_ACCENT,
      createdAt: now,
      description: input.description?.trim() || `${name} workspace.`,
      id: requireText(input.id, "Space id is required."),
      name,
      updatedAt: now,
    });
  }

  static rehydrate(dto: SpaceDTO): Space {
    return new Space({ ...dto });
  }

  updateDetails(input: UpdateSpaceDetailsInput): Space {
    return new Space({
      ...this.dto,
      accent: input.accent?.trim() || this.dto.accent,
      description: input.description?.trim() || this.dto.description,
      name: input.name?.trim() || this.dto.name,
      updatedAt: requireText(input.now, "Space timestamp is required."),
    });
  }

  toDTO(): SpaceDTO {
    return { ...this.dto };
  }
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(message);
  }

  return trimmed;
}
