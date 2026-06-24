export function apiFetch(path: string, init?: RequestInit): Promise<Response>;
export function buildApiUrl(path: string): string;
export function createApiEventSource(path: string): EventSource;
export function refreshAuthTokens(options?: { force?: boolean }): Promise<boolean>;
