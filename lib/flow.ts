export const FLOW_STORAGE_KEY = "sm-flow-mode";
export const FLOW_COOKIE_NAME = "sm-flow-mode";
export const FLOW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseFlowPreference(value: string | undefined | null) {
  return value === "true";
}

export function applyFlowPreference(element: HTMLElement, enabled: boolean) {
  if (enabled) {
    element.setAttribute("data-flow", "true");
    return;
  }

  element.removeAttribute("data-flow");
}

export function persistFlowPreference(enabled: boolean) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const value = String(enabled);

  try {
    window.localStorage.setItem(FLOW_STORAGE_KEY, value);
  } catch {}

  document.cookie = `${FLOW_COOKIE_NAME}=${value}; path=/; max-age=${FLOW_COOKIE_MAX_AGE}; samesite=lax`;
}

export function getFlowInitScript() {
  return `
    try {
      var stored = localStorage.getItem("${FLOW_STORAGE_KEY}");
      var enabled = stored === "true";
      if (enabled) {
        document.documentElement.setAttribute("data-flow", "true");
      } else {
        document.documentElement.removeAttribute("data-flow");
      }
      document.cookie = "${FLOW_COOKIE_NAME}=" + String(enabled) + "; path=/; max-age=${FLOW_COOKIE_MAX_AGE}; samesite=lax";
    } catch (_) {}
  `;
}
