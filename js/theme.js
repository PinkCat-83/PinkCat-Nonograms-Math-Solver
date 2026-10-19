/**
 * Theme module (light / dark).
 *
 * By default the app follows the operating system's setting
 * (`prefers-color-scheme`, handled purely in CSS). The header button
 * switches to the opposite of whatever is showing right now and
 * remembers that choice in localStorage; from then on the manual choice
 * wins over the system setting. The saved theme is re-applied before
 * the first paint by a tiny inline script in index.html's <head>, so
 * there's no flash of the wrong theme on load.
 *
 * All colors live as CSS custom properties in css/style.css: one light
 * block in `:root`, and the same dark block twice (inside the
 * `prefers-color-scheme: dark` media query, and under
 * `:root[data-theme="dark"]`).
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const STORAGE_KEY = "nonogram-theme";
  const systemDarkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  let toggleButton = null;

  /** @returns {"light"|"dark"} the theme actually on screen right now */
  function getEffectiveTheme() {
    const chosen = document.documentElement.dataset.theme;
    if (chosen === "light" || chosen === "dark") {
      return chosen;
    }
    return systemDarkQuery && systemDarkQuery.matches ? "dark" : "light";
  }

  /** Switches to the opposite theme and remembers the choice. */
  function toggle() {
    const next = getEffectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_error) {
      // Private mode / blocked storage: the switch still works for this visit.
    }
    applyTranslations();
  }

  /** Updates the button's icon and its (localized) accessible label. */
  function applyTranslations() {
    if (!toggleButton) {
      return;
    }
    const isDark = getEffectiveTheme() === "dark";
    // Shows what you'll switch TO: a sun while dark, a moon while light.
    toggleButton.textContent = isDark ? "☀" : "☾";
    const label = app.i18n.t(isDark ? "theme_switch_to_light" : "theme_switch_to_dark");
    toggleButton.setAttribute("aria-label", label);
    toggleButton.title = label;
    toggleButton.setAttribute("aria-pressed", String(isDark));
  }

  function init() {
    toggleButton = document.getElementById("theme-toggle");
    if (!toggleButton) {
      return;
    }
    toggleButton.addEventListener("click", toggle);

    // Keep the icon in sync if the system theme changes while the app is open.
    if (systemDarkQuery) {
      const onSystemChange = () => applyTranslations();
      if (systemDarkQuery.addEventListener) {
        systemDarkQuery.addEventListener("change", onSystemChange);
      } else if (systemDarkQuery.addListener) {
        systemDarkQuery.addListener(onSystemChange);
      }
    }

    applyTranslations();
  }

  app.Theme = { init, applyTranslations, getEffectiveTheme };
})(window.NonogramApp);
