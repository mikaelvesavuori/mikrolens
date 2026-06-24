import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpired,
  saveAuthTokens,
} from "../auth/tokens.js";
import { state } from "../state/state.js";

let refreshPromise = null;

export async function apiFetch(path, init = {}) {
  const publicRequest = isPublicApiPath(path);
  const headers = new Headers(init.headers ?? {});

  if (!publicRequest) {
    await refreshAuthTokensIfNeeded();
    const accessToken = getAccessToken();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: init.credentials ?? resolveCredentialsMode(),
    headers,
  });

  if (response.status !== 401 || publicRequest || !getRefreshToken()) {
    return response;
  }

  const refreshed = await refreshAuthTokens({ force: true });

  if (!refreshed) {
    clearAuthTokens();
    return response;
  }

  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set("Authorization", `Bearer ${getAccessToken()}`);

  return fetch(buildApiUrl(path), {
    ...init,
    credentials: init.credentials ?? resolveCredentialsMode(),
    headers: retryHeaders,
  });
}

export function buildApiUrl(path) {
  return new URL(path, resolveApiBaseUrl()).toString();
}

export function createApiEventSource(path) {
  const url = new URL(buildApiUrl(path));
  const accessToken = getAccessToken();

  if (accessToken && !isPublicApiPath(path)) {
    url.searchParams.set("access_token", accessToken);
  }

  return new EventSource(url.toString(), {
    withCredentials: resolveCredentialsMode() === "include",
  });
}

export async function refreshAuthTokens({ force = false } = {}) {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  if (!force && !isAccessTokenExpired()) {
    return true;
  }

  if (!refreshPromise) {
    refreshPromise = fetch(buildApiUrl("/auth/refresh"), {
      body: JSON.stringify({ refreshToken }),
      credentials: resolveCredentialsMode(),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }

        return saveAuthTokens(await response.json());
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function refreshAuthTokensIfNeeded() {
  if (!isAccessTokenExpired()) {
    return true;
  }

  return refreshAuthTokens();
}

function isPublicApiPath(path) {
  const pathname = new URL(path, window.location.origin).pathname;

  return (
    pathname === "/health" ||
    pathname === "/api/health" ||
    pathname === "/openapi.json" ||
    pathname === "/auth/login" ||
    pathname === "/auth/logout" ||
    pathname === "/auth/metadata" ||
    pathname === "/auth/demo-users" ||
    pathname === "/auth/demo-login" ||
    pathname === "/auth/refresh" ||
    pathname === "/auth/verify" ||
    pathname.startsWith("/auth/oauth/")
  );
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveCredentialsMode() {
  return getApiOrigin() === window.location.origin ? "same-origin" : "include";
}

function getApiOrigin() {
  return new URL(buildApiUrl("/")).origin;
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = state.config?.api?.baseUrl || window.location.origin;
  const apiUrl = new URL(ensureTrailingSlash(configuredBaseUrl));
  const frontendUrl = new URL(window.location.origin);

  if (
    apiUrl.protocol === frontendUrl.protocol &&
    isLoopbackHost(apiUrl.hostname) &&
    isLoopbackHost(frontendUrl.hostname)
  ) {
    apiUrl.hostname = frontendUrl.hostname;
  }

  return apiUrl.toString();
}

function isLoopbackHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}
