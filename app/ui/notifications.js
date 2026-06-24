import { state } from "../state/state.js";
import { renderNotifications } from "./render.js";

const DEFAULT_DURATION = 4200;
const timers = new Map();
let nextNotificationId = 0;

export function showSuccess(message, options = {}) {
  return showNotification({ ...options, message, tone: "success" });
}

export function showError(message, options = {}) {
  return showNotification({ ...options, message, tone: "error" });
}

export function showInfo(message, options = {}) {
  return showNotification({ ...options, message, tone: "info" });
}

export function showWarning(message, options = {}) {
  return showNotification({ ...options, message, tone: "warning" });
}

export function dismissNotification(notificationId) {
  clearNotificationTimer(notificationId);
  const nextNotifications = state.notifications.filter(
    (notification) => notification.id !== notificationId,
  );

  if (nextNotifications.length === state.notifications.length) {
    return;
  }

  state.notifications = nextNotifications;
  renderNotifications();
}

function showNotification({ duration = DEFAULT_DURATION, message, tone = "info" }) {
  const trimmedMessage = String(message ?? "").trim();

  if (!trimmedMessage) {
    return "";
  }

  nextNotificationId += 1;
  const id = `notification-${nextNotificationId}`;
  state.notifications = [...state.notifications, { id, message: trimmedMessage, tone }];
  renderNotifications();

  if (duration > 0) {
    const timer = window.setTimeout(() => {
      dismissNotification(id);
    }, duration);

    timers.set(id, timer);
  }

  return id;
}

function clearNotificationTimer(notificationId) {
  const timer = timers.get(notificationId);

  if (timer === undefined) {
    return;
  }

  window.clearTimeout(timer);
  timers.delete(notificationId);
}
