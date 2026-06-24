import { ValidationError } from "../errors/MikroLensError.ts";
import type { HorizonKey } from "./Horizon.ts";

export type DocumentType = "Strategy" | "Evolution" | "Note";

/**
 * @description The richer narrative record for durable reasoning and history.
 */
export interface DocumentDTO {
  id: string;
  spaceId: string | null;
  type: DocumentType;
  title: string;
  summary: string;
  markdown: string;
  horizonId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const documentTypes = ["Strategy", "Evolution", "Note"] as const;

/**
 * @description A simple link between compact operational work and a richer document.
 */
export interface DocumentLink {
  id: string;
  workItemId: string;
  documentId: string;
  relation: string;
  documentSection: string;
}

/**
 * @description Lightweight document payload for lists and linked references.
 */
export interface DocumentSummary {
  horizonKey: HorizonKey | null;
  id: string;
  type: DocumentType;
  title: string;
  summary: string;
  spaceId: string | null;
  spaceName: string | null;
  horizonName: string | null;
}

export interface CreateDocumentInput {
  horizonId?: string | null;
  id: string;
  markdown: string;
  now: string;
  spaceId?: string | null;
  summary: string;
  title: string;
  type: DocumentType;
}

export interface ApplyDocumentUpdateInput {
  horizonId?: string | null;
  markdown?: string;
  now: string;
  summary?: string;
  title?: string;
  type?: DocumentType;
}

export class Document {
  private readonly dto: DocumentDTO;

  private constructor(dto: DocumentDTO) {
    this.dto = dto;
  }

  static create(input: CreateDocumentInput): Document {
    const now = requireText(input.now, "Document timestamp is required.");

    return new Document({
      createdAt: now,
      horizonId: input.horizonId ?? null,
      id: requireText(input.id, "Document id is required."),
      markdown: requireText(input.markdown, "Document markdown is required."),
      spaceId: normalizeOptionalText(input.spaceId),
      summary: normalizeSummary(input.summary),
      title: requireText(input.title, "Document title is required."),
      type: input.type,
      updatedAt: now,
    });
  }

  static rehydrate(dto: DocumentDTO): Document {
    return new Document({ ...dto });
  }

  applyEditorialUpdate(input: ApplyDocumentUpdateInput): Document {
    return new Document({
      ...this.dto,
      horizonId: input.horizonId === undefined ? this.dto.horizonId : input.horizonId,
      markdown: input.markdown?.trim() || this.dto.markdown,
      summary: input.summary === undefined ? this.dto.summary : normalizeSummary(input.summary),
      title: input.title?.trim() || this.dto.title,
      type: input.type ?? this.dto.type,
      updatedAt: requireText(input.now, "Document timestamp is required."),
    });
  }

  toDTO(): DocumentDTO {
    return { ...this.dto };
  }
}

/**
 * @description Narrow a free-form string to a valid document type.
 */
export function isDocumentType(value: string): value is DocumentType {
  return documentTypes.includes(value as DocumentType);
}

function requireText(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(message);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizeSummary(value: string | null | undefined): string {
  return value?.trim() ?? "";
}
