export const THEME_STORAGE_KEY = "sm-theme";

export type ThemePreference = "system" | "light" | "dark";

export function applyThemePreference(
  element: HTMLElement,
  preference: ThemePreference
) {
  if (preference === "system") {
    element.removeAttribute("data-theme");
    return;
  }

  element.setAttribute("data-theme", preference);
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
}

export function getThemeInitScript() {
  return `
    try {
      var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
      if (stored === "light" || stored === "dark") {
        document.documentElement.setAttribute("data-theme", stored);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } catch (_) {}
  `;
}
