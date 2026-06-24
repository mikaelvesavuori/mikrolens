import { apiFetch, buildApiUrl } from "../core/api.js";
import { stopDocumentEditing } from "../documents/documentEditor.js";
import { getUserDisplayName } from "../shared/helpers.js";
import { refreshSnapshot } from "../shell/actions.js";
import { state } from "../state/state.js";
import { showError, showSuccess } from "../ui/notifications.js";
import { render } from "../ui/render.js";
import { clearAuthTokens, getRefreshToken, hasAuthTokens, saveAuthTokens } from "./tokens.js";

const AUTH_SESSION_KEY = "mikrolens-auth-session";
const POST_AUTH_PATH_KEY = "mikrolens-post-auth-path";

export async function initializeAuth() {
  restoreAuthSession();
  await hydrateAuthNotice();
  state.auth.requiresAuthentication = await resolveAuthenticationRequirement();

  if (state.auth.requiresAuthentication) {
    await reconcileAuthSession();
    await loadDemoUsers();
  } else {
    clearAuthSession();
    state.auth.demoUsers = [];
  }

  if (state.config?.auth?.enableOAuth !== false) {
    await loadOAuthProviders();
  } else {
    state.auth.oauthProviders = [];
  }

  if (!state.auth.requiresAuthentication || state.auth.isAuthenticated) {
    state.auth.screen = "form";
    return true;
  }

  persistPostAuthPath();
  render();
  return false;
}

export function beginOAuthSignIn(providerId) {
  if (!providerId) {
    return;
  }

  persistPostAuthPath();
  window.location.href = buildApiUrl(`/auth/oauth/${encodeURIComponent(providerId)}`);
}

export function signOut() {
  const refreshToken = getRefreshToken();
  clearAuthSession();
  void apiFetch("/auth/logout", {
    body: JSON.stringify({ refreshToken }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch(() => {});
  stopDocumentEditing();
  state.auth.screen = "form";
  state.mobileNavOpen = false;
  showSuccess("Signed out.");
  render();
}

export async function submitAuthEmail(form) {
  const formData = new FormData(form);
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    showError("Enter an email address to continue.");
    return;
  }

  state.auth.pending = true;
  persistPostAuthPath();
  render();

  try {
    const response = await apiFetch("/auth/login", {
      body: JSON.stringify({ email }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Unable to send a sign-in link.");
    }

    state.auth.pending = false;
    state.auth.screen = "sent";
    state.auth.pendingEmail = email;
    render();
  } catch (error) {
    state.auth.pending = false;
    state.auth.screen = "form";
    showError(error instanceof Error ? error.message : "Unable to send a sign-in link.");
    render();
  }
}

export async function submitDemoSignIn(userId) {
  if (!userId) {
    showError("Choose a demo user to continue.");
    return;
  }

  state.auth.pendingDemoUserId = userId;
  persistPostAuthPath();
  render();

  try {
    const response = await apiFetch("/auth/demo-login", {
      body: JSON.stringify({ userId }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Unable to sign in as that demo user.");
    }

    const payload = await response.json();
    const user = payload?.user;

    if (
      !user ||
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      typeof user.role !== "string"
    ) {
      throw new Error("Demo sign-in did not return a valid user session.");
    }

    if (!saveAuthTokens(payload)) {
      throw new Error("Demo sign-in did not return valid auth tokens.");
    }

    applyAuthenticatedUser(user);
    state.auth.pendingDemoUserId = "";
    state.auth.screen = "form";
    persistAuthSession(user);
    restorePostAuthPath();
    showSuccess(`Signed in as ${getUserDisplayName(user, user.email)}.`);
    render();
    await refreshSnapshot();
  } catch (error) {
    state.auth.pendingDemoUserId = "";
    showError(error instanceof Error ? error.message : "Unable to sign in as that demo user.");
    render();
  }
}

export function showAuthForm() {
  state.auth.pending = false;
  state.auth.pendingDemoUserId = "";
  state.auth.pendingEmail = "";
  state.auth.screen = "form";
  state.auth.errorMessage = "";
  render();
}

async function loadOAuthProviders() {
  try {
    const response = await apiFetch("/auth/oauth/providers");

    if (!response.ok) {
      state.auth.oauthProviders = [];
      return;
    }

    const payload = await response.json();
    state.auth.oauthProviders = Array.isArray(payload.providers) ? payload.providers : [];
  } catch {
    state.auth.oauthProviders = [];
  }
}

async function loadDemoUsers() {
  try {
    const response = await apiFetch("/auth/demo-users");

    if (!response.ok) {
      state.auth.demoUsers = [];
      return;
    }

    const payload = await response.json();
    state.auth.demoUsers = Array.isArray(payload?.users) ? payload.users : [];
  } catch {
    state.auth.demoUsers = [];
  }
}

async function hydrateAuthNotice() {
  const url = new URL(window.location.href);
  const authStatus = url.searchParams.get("auth");
  const email = url.searchParams.get("email") ?? "";
  const message = url.searchParams.get("message") ?? "";
  const accessToken = url.searchParams.get("access_token") ?? "";
  const refreshToken = url.searchParams.get("refresh_token") ?? "";
  const expiresIn = url.searchParams.get("expires_in") ?? "";
  const linkToken = url.searchParams.get("token") ?? "";

  if (accessToken && refreshToken) {
    if (
      saveAuthTokens({
        accessToken,
        exp: expiresIn,
        refreshToken,
      })
    ) {
      state.auth.currentUserEmail = email;
      state.auth.isAuthenticated = true;
      state.auth.screen = "form";
      persistAuthSession({ email });
      showSuccess(email ? `Signed in as ${email}.` : "Signed in successfully.");
    }

    scrubAuthQuery(url);
    restorePostAuthPath();
    return;
  }

  if (linkToken && email) {
    try {
      const response = await apiFetch("/auth/verify", {
        body: JSON.stringify({ email, token: linkToken }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("The sign-in link could not be verified.");
      }

      const payload = await response.json();
      const user = payload?.user;

      if (!saveAuthTokens(payload) || !user?.email) {
        throw new Error("The sign-in link did not return a valid session.");
      }

      applyAuthenticatedUser(user);
      persistAuthSession(user);
      showSuccess(`Signed in as ${user.email}.`);
      scrubAuthQuery(url);
      if (!restorePostAuthPath()) {
        window.history.replaceState({}, document.title, "/");
      }
      return;
    } catch (error) {
      state.auth.errorMessage =
        error instanceof Error ? error.message : "The sign-in attempt could not be verified.";
      state.auth.screen = "error";
      showError(state.auth.errorMessage);
      scrubAuthQuery(url);
      return;
    }
  }

  if (authStatus === "success") {
    state.auth.currentUserEmail = email;
    state.auth.isAuthenticated = true;
    state.auth.screen = "form";
    persistAuthSession({ email });
    showSuccess(email ? `Signed in as ${email}.` : "Signed in successfully.");
  } else if (authStatus === "error") {
    state.auth.errorMessage = message || "The sign-in attempt could not be verified.";
    state.auth.screen = "error";
    showError(state.auth.errorMessage);
  } else {
    return;
  }

  scrubAuthQuery(url);
  restorePostAuthPath();
}

function persistAuthSession(user) {
  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      email: user?.email ?? "",
      id: user?.id ?? "",
      permissions: Array.isArray(user?.permissions) ? user.permissions : [],
      role: user?.role ?? "",
      signedInAt: new Date().toISOString(),
    }),
  );
}

function clearAuthSession() {
  clearAuthTokens();
  localStorage.removeItem(AUTH_SESSION_KEY);
  state.auth.currentUserEmail = "";
  state.auth.currentUserId = "";
  state.auth.currentUserRole = "";
  state.auth.permissions = [];
  state.auth.pendingDemoUserId = "";
  state.auth.isAuthenticated = false;
}

function persistPostAuthPath() {
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (!currentPath || currentPath === "/" || currentPath === "/index.html") {
    return;
  }

  localStorage.setItem(POST_AUTH_PATH_KEY, currentPath);
}

function restoreAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) ?? "{}");

    if (typeof session.email === "string" && session.email && hasAuthTokens()) {
      state.auth.currentUserEmail = session.email;
      state.auth.currentUserId = typeof session.id === "string" ? session.id : "";
      state.auth.currentUserRole = typeof session.role === "string" ? session.role : "";
      state.auth.permissions = Array.isArray(session.permissions) ? session.permissions : [];
      state.auth.isAuthenticated = true;
    }
  } catch {
    clearAuthSession();
  }
}

function restorePostAuthPath() {
  const savedPath = localStorage.getItem(POST_AUTH_PATH_KEY) ?? "";

  if (!savedPath) {
    return false;
  }

  localStorage.removeItem(POST_AUTH_PATH_KEY);
  window.history.replaceState({}, document.title, savedPath);
  return true;
}

async function resolveAuthenticationRequirement() {
  const mode = String(state.config?.auth?.mode ?? "auto")
    .trim()
    .toLowerCase();

  if (mode === "disabled") {
    return false;
  }

  if (mode === "required") {
    return true;
  }

  try {
    const response = await apiFetch("/auth/metadata");

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.authenticationRequired === true;
  } catch {
    return false;
  }
}

async function reconcileAuthSession() {
  try {
    const response = await apiFetch("/auth/session");

    if (!response.ok) {
      clearAuthSession();
      return;
    }

    const payload = await response.json();
    const user = payload?.user;

    if (
      !user ||
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      typeof user.role !== "string"
    ) {
      clearAuthSession();
      return;
    }

    state.auth.currentUserEmail = user.email;
    state.auth.currentUserId = user.id;
    state.auth.currentUserRole = user.role;
    state.auth.permissions = Array.isArray(user.permissions) ? user.permissions : [];
    state.auth.isAuthenticated = true;
    persistAuthSession(user);
  } catch {
    clearAuthSession();
  }
}

function applyAuthenticatedUser(user) {
  state.auth.currentUserEmail = user.email;
  state.auth.currentUserId = user.id ?? "";
  state.auth.currentUserRole = user.role ?? "";
  state.auth.permissions = Array.isArray(user.permissions) ? user.permissions : [];
  state.auth.errorMessage = "";
  state.auth.isAuthenticated = true;
  state.auth.pending = false;
}

function scrubAuthQuery(url) {
  for (const key of [
    "access_token",
    "auth",
    "email",
    "expires_in",
    "message",
    "refresh_token",
    "token",
    "token_type",
  ]) {
    url.searchParams.delete(key);
  }

  window.history.replaceState({}, document.title, url.toString());
}
