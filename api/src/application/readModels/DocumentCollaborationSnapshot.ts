export interface DocumentCollaborationSnapshot {
  createdAt?: string;
  horizonId: string | null;
  markdown: string;
  summary: string;
  title: string;
  type: string;
  updatedAt: string;
}
