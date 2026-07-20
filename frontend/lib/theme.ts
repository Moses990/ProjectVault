export type ThemePreference = "system" | "dark" | "light";

export const THEME_STORAGE_KEY = "pv-theme";
export const THEME_CHANGE_EVENT = "pv-theme-change";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(theme: ThemePreference, systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.classList.toggle("theme-light", theme === "light" || theme === "system" && !systemDark);
}

export function previewTheme(theme: ThemePreference) {
  window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, { detail: theme }));
}

export function persistTheme(theme: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  previewTheme(theme);
}
