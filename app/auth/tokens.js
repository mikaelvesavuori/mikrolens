const ACCESS_TOKEN_KEY = "mikrolens-access-token";
const REFRESH_TOKEN_KEY = "mikrolens-refresh-token";
const TOKEN_EXPIRY_KEY = "mikrolens-token-expiry";

export function saveAuthTokens(payload) {
  const accessToken = String(payload?.accessToken ?? payload?.access_token ?? "").trim();
  const refreshToken = String(payload?.refreshToken ?? payload?.refresh_token ?? "").trim();
  const expiresIn = Number(payload?.exp ?? payload?.expiresIn ?? payload?.expires_in ?? 0);

  if (!accessToken || !refreshToken) {
    return false;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + Math.max(expiresIn, 0) * 1000));
  return true;
}

export function updateAccessToken(payload) {
  const accessToken = String(payload?.accessToken ?? payload?.access_token ?? "").trim();
  const expiresIn = Number(payload?.exp ?? payload?.expiresIn ?? payload?.expires_in ?? 0);

  if (!accessToken) {
    return false;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + Math.max(expiresIn, 0) * 1000));
  return true;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";
}

export function hasAuthTokens() {
  return Boolean(getAccessToken() && getRefreshToken());
}

export function isAccessTokenExpired(skewMs = 30_000) {
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? "0");

  if (!expiresAt) {
    return false;
  }

  return Date.now() + skewMs >= expiresAt;
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}
