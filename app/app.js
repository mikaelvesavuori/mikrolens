import { initializeAuth } from "./auth/auth.js";
import { loadConfig } from "./core/config.js";
import { stopDocumentEditing } from "./documents/documentEditor.js";
import { applyLocationToState, replaceCurrentUrl } from "./routing/navigation.js";
import { ensureDocumentDetail, refreshSnapshot } from "./shell/actions.js";
import { bindEvents } from "./shell/events.js";
import { restoreUiState, state } from "./state/state.js";
import { render } from "./ui/render.js";

restoreUiState();
bindEvents();
bindHistoryEvents();
void unregisterLegacyServiceWorkers();
void initializeApp();

async function initializeApp() {
  state.config = await loadConfig();
  const canShowApp = await initializeAuth();
  applyLocationToState({ clearMissingSpaceId: false });
  replaceCurrentUrl();
  render();

  if (canShowApp) {
    applyLocationToState({ clearMissingSpaceId: false });
    replaceCurrentUrl();
    await refreshSnapshot();
    return;
  }

  render();
}

async function unregisterLegacyServiceWorkers() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }
  } catch {
    // Best-effort cleanup for browsers that still have older MikroLens app workers.
  }
}

function bindHistoryEvents() {
  window.addEventListener("popstate", () => {
    if (state.auth.requiresAuthentication && !state.auth.isAuthenticated) {
      render();
      return;
    }

    const changes = applyLocationToState({
      clearMissingSpaceId: true,
      defaultArea: "Understand",
    });

    render();

    if (changes.spaceChanged) {
      stopDocumentEditing();
      void refreshSnapshot();
      return;
    }

    if (changes.documentChanged && !state.selectedDocumentId) {
      stopDocumentEditing();
    }

    if (changes.documentChanged && state.selectedDocumentId) {
      void ensureDocumentDetail(state.selectedDocumentId, { force: true });
    }
  });
}
