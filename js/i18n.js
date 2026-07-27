/**
 * Internationalization (i18n) engine.
 *
 * Loads every UI-facing string — the app's own "chrome" (buttons,
 * labels, messages) AND each rule's `name`/`hint` — from a single
 * spreadsheet-style file, `language/translations.csv`, instead of
 * keeping them hardcoded in JS. One row per text key, one column per
 * language. Rule files reference these by *key* (plain strings like
 * `"rule_block_complete_name"`), not by literal text — see
 * `js/rules/*.js` and `ruleManager.js`.
 *
 * Loaded first (before ruleManager.js and everything else), but its
 * dictionaries start out EMPTY until `load()` resolves — see
 * `main.js`, which awaits `app.i18n.load()` before doing anything
 * else, so no other module ever sees translations mid-load.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const CSV_URL = "language/translations.csv";
  const CSV_DELIMITER = ";";
  const STORAGE_KEY = "nonogram-locale";
  const DEFAULT_LOCALE = "es";

  // Maps the CSV header's column names (written out as the language's
  // own display name, e.g. "Español") to the short locale code we use
  // everywhere else in the app (aria labels, <html lang>, localStorage).
  // If the CSV's header text ever changes, this mapping needs updating
  // too — see README_TECH.md for this known fragility.
  const COLUMN_NAME_TO_LOCALE = {
    Español: "es",
    English: "en",
    Français: "fr",
  };

  const translations = {}; // { [locale]: { [key]: string } }, filled in by load()
  const localeDisplayNames = {}; // { [locale]: string }, e.g. { es: "Español" }
  let availableLocales = []; // locale codes, in the order their columns appear in the CSV

  let currentLocale = detectInitialLocale();
  let onLocaleChangeCallback = null;
  let loadPromise = null;

  /**
   * Reads the previously chosen locale from localStorage, if any.
   * Wrapped in try/catch because localStorage can throw in some
   * contexts (privacy mode, sandboxed iframes) — falling back to the
   * default silently is preferable to crashing. Note this only reads
   * a *code* ("es"/"en"/"fr"); it can't yet check that code is still
   * valid, since the CSV (which defines what's actually available)
   * hasn't loaded when this runs — `load()` re-validates it below.
   * @returns {string}
   */
  function detectInitialLocale() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return saved;
      }
    } catch (error) {
      // Ignore — persistence is a nice-to-have, not a requirement.
    }
    return DEFAULT_LOCALE;
  }

  /**
   * Parses one CSV line into an array of field values. Supports
   * double-quoted fields (so a value can contain the `;` delimiter or
   * a literal `"` doubled as `""`) — the same convention spreadsheet
   * apps use, even though none of our current translations actually
   * need it (we write around embedded `;` instead — see the CSV file
   * itself). Kept anyway so a future translator pasting text from
   * Excel doesn't quietly corrupt the file.
   *
   * Crucially, a `"` only starts quoted-field mode when it's the very
   * first character of that field (right after a delimiter, or at the
   * start of the line) — a quote appearing anywhere else in an
   * already-unquoted field (e.g. `Regla "{name}" activada`) is just a
   * literal character, not CSV quoting.
   * @param {string} line
   * @returns {string[]}
   */
  function parseCsvLine(line) {
    const fields = [];
    let current = "";
    let insideQuotes = false;
    let isStartOfField = true;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (insideQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            insideQuotes = false;
          }
        } else {
          current += char;
        }
      } else if (char === '"' && isStartOfField) {
        insideQuotes = true;
        isStartOfField = false;
      } else if (char === CSV_DELIMITER) {
        fields.push(current);
        current = "";
        isStartOfField = true;
      } else {
        current += char;
        isStartOfField = false;
      }
    }

    fields.push(current);
    return fields;
  }

  /**
   * Parses the whole CSV text into `translations`/`localeDisplayNames`/
   * `availableLocales`. The first column is always the key; every
   * other column is a language, identified by its header text via
   * `COLUMN_NAME_TO_LOCALE`. An unrecognized header logs a console
   * error and is otherwise ignored (its column is simply skipped),
   * rather than breaking the whole file.
   * @param {string} csvText
   */
  function parseTranslationsCsv(csvText) {
    const withoutBom = csvText.replace(/^\uFEFF/, "");
    const lines = withoutBom.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return;
    }

    const headerColumns = parseCsvLine(lines[0]);
    const localeByColumnIndex = [];

    headerColumns.forEach((columnName, index) => {
      if (index === 0) {
        return; // the "key" column
      }
      const trimmedName = columnName.trim();
      const locale = COLUMN_NAME_TO_LOCALE[trimmedName];
      if (!locale) {
        console.error(`translations.csv: unrecognized language column "${trimmedName}", skipped`);
        return;
      }
      localeByColumnIndex[index] = locale;
      localeDisplayNames[locale] = trimmedName;
      translations[locale] = translations[locale] || {};
      if (availableLocales.indexOf(locale) === -1) {
        availableLocales.push(locale);
      }
    });

    for (let row = 1; row < lines.length; row += 1) {
      const columns = parseCsvLine(lines[row]);
      const key = (columns[0] || "").trim();
      if (!key) {
        continue;
      }
      columns.forEach((value, index) => {
        const locale = localeByColumnIndex[index];
        if (locale) {
          translations[locale][key] = value;
        }
      });
    }
  }

  /**
   * Fetches and parses `language/translations.csv`. Safe to call more
   * than once — every caller gets the same promise, and the fetch
   * itself only happens once.
   *
   * If it fails (missing file, opened without a local server, bad
   * CSV), this does NOT throw or leave the app hanging: it logs a
   * clear console error and resolves anyway with empty dictionaries.
   * `t()` then falls back to showing the raw key as visible text —
   * ugly, but obvious to spot and debug, unlike a silently broken or
   * frozen page. There's deliberately no second hardcoded copy of
   * every string as a JS fallback: that would defeat the point of
   * moving them out of the code in the first place.
   * @returns {Promise<void>}
   */
  function load() {
    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = fetch(CSV_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((csvText) => {
        parseTranslationsCsv(csvText);
        // Now that we know which locales actually exist, make sure the
        // locale read from localStorage is still a real one.
        if (availableLocales.indexOf(currentLocale) === -1) {
          currentLocale = DEFAULT_LOCALE;
        }
      })
      .catch((error) => {
        console.error(`Could not load ${CSV_URL}:`, error);
      });

    return loadPromise;
  }

  /**
   * Translates a key for the current locale, interpolating any
   * `{placeholder}` tokens with the given params. Falls back to
   * Spanish, then to the raw key itself, if a translation is missing
   * (so a typo'd key — or a CSV that hasn't loaded yet — shows up as
   * visible, debuggable text instead of "undefined").
   * @param {string} key
   * @param {Object<string, string|number>} [params]
   * @returns {string}
   */
  function t(key, params) {
    const template =
      (translations[currentLocale] && translations[currentLocale][key]) ||
      (translations[DEFAULT_LOCALE] && translations[DEFAULT_LOCALE][key]) ||
      key;

    if (!params) {
      return template;
    }

    return Object.keys(params).reduce((text, paramName) => {
      const pattern = new RegExp(`\\{${paramName}\\}`, "g");
      return text.replace(pattern, String(params[paramName]));
    }, template);
  }

  /** @returns {string[]} locale codes, in the order their columns appear in the CSV */
  function getSupportedLocales() {
    return availableLocales.slice();
  }

  /**
   * @param {string} locale
   * @returns {string} that language's own display name, exactly as
   *   written in the CSV header (e.g. "Français") — not translated,
   *   since a language switcher conventionally shows every option in
   *   its own language, regardless of the current UI language.
   */
  function getLocaleDisplayName(locale) {
    return localeDisplayNames[locale] || locale;
  }

  /** @returns {string} the current locale code ("es" | "en" | "fr") */
  function getLocale() {
    return currentLocale;
  }

  /**
   * Switches the current locale, persists the choice, and notifies
   * whoever registered via `onLocaleChange` so the UI can re-render.
   * @param {string} locale
   */
  function setLocale(locale) {
    if (availableLocales.indexOf(locale) === -1 || locale === currentLocale) {
      return;
    }

    currentLocale = locale;

    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch (error) {
      // Ignore — persistence is a nice-to-have, not a requirement.
    }

    if (typeof onLocaleChangeCallback === "function") {
      onLocaleChangeCallback(currentLocale);
    }
  }

  /**
   * Registers the single callback fired whenever `setLocale` actually
   * changes the language (only one listener needed — main.js is the
   * only module that re-renders UI text).
   * @param {function(string): void} callback
   */
  function onLocaleChange(callback) {
    onLocaleChangeCallback = callback;
  }

  app.i18n = {
    DEFAULT_LOCALE,
    load,
    t,
    getSupportedLocales,
    getLocaleDisplayName,
    getLocale,
    setLocale,
    onLocaleChange,
  };
})(window.NonogramApp);
