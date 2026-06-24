export interface MikroLensUiState {
  activeArea: string;
  activeSpaceId: string;
  activeViewId: string;
  auth: {
    currentUserEmail: string;
    currentUserId: string;
    currentUserRole: string;
    demoUsers: Array<{
      email: string;
      id: string;
      name: string | null;
      role: string;
      status: string;
    }>;
    errorMessage: string;
    isAuthenticated: boolean;
    oauthProviders: unknown[];
    pending: boolean;
    pendingDemoUserId: string;
    pendingEmail: string;
    requiresAuthentication: boolean;
    screen: string;
  };
  config: {
    api?: {
      baseUrl?: string;
    };
  } | null;
  directSearch: string;
  directType: string;
  planDisplay: string;
  planTimelineSort: string;
  search: string;
  selectedWorkItemId: string;
  settingsSubview: string;
  theme: string;
  workSort: string;
  workView: string;
  [key: string]: unknown;
}

export const AREAS: readonly string[];
export const STORAGE_KEY: string;
export const state: MikroLensUiState;
export const elements: Record<string, HTMLElement | null>;

export function applyTheme(): void;
export function persistUiState(): void;
export function restoreUiState(): void;
