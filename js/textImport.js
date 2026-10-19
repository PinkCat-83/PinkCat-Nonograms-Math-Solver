/**
 * Text import module.
 *
 * Lets the person paste a whole nonogram as plain text (typically the
 * output of an AI that transcribed a photo) and loads it into the board
 * straight away. Format:
 *
 *   COLS
 *   1,5,8,7      <- one line per column, left to right, clues top to bottom
 *   0            <- "0" (or nothing but zeros) = column without clues
 *   5,3,4
 *
 *   ROWS
 *   1,8,5        <- one line per row, top to bottom, clues left to right
 *   1,3,2
 *   4,5
 *
 * Tolerant on purpose, since AI output is never perfectly clean:
 *   - sections can come in either order;
 *   - headers are case-insensitive and accept ES/EN/FR names
 *     (COLS, COLUMNS, COLUMNAS, COLONNES / ROWS, FILAS, LIGNES), with an
 *     optional trailing ":";
 *   - any non-digit character separates clues (",", " ", ".", "-"...);
 *   - a "label:" prefix on a line ("Columna 3: 1,2") is ignored;
 *   - blank lines, markdown code fences and any text before the first
 *     header are skipped.
 *
 * Also provides a ready-made prompt (localized, in translations.csv) to
 * copy into the AI so it answers in exactly this format.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const MAX_DIMENSION = 25;
  const COLS_HEADER = /^(cols?|columns?|columnas?|colonnes?)\s*:?$/i;
  const ROWS_HEADER = /^(rows?|filas?|lignes?)\s*:?$/i;

  let elements = {};
  let onImported = null;
  let onMessage = null;

  /**
   * Parses the text format into a scenario-shaped object.
   * @param {string} text
   * @returns {{ok: true, scenario: Object} | {ok: false, errorKey: string, params?: Object}}
   */
  function parse(text) {
    const sections = { cols: null, rows: null };
    let current = null;

    text.split(/\r\n|\r|\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("```")) {
        return;
      }
      if (COLS_HEADER.test(line)) {
        current = "cols";
        sections.cols = [];
        return;
      }
      if (ROWS_HEADER.test(line)) {
        current = "rows";
        sections.rows = [];
        return;
      }
      if (!current) {
        return; // anything before the first header (e.g. "Here you go:")
      }

      const content = line.includes(":") ? line.slice(line.lastIndexOf(":") + 1) : line;
      if (!/\d/.test(content)) {
        return; // stray text line inside a section
      }

      const values = content
        .split(/[^0-9]+/)
        .filter((token) => token.length > 0)
        .map((token) => parseInt(token, 10))
        .filter((value) => value > 0); // "0" means "no clues"

      sections[current].push(values);
    });

    if (!sections.cols || !sections.rows) {
      return { ok: false, errorKey: "import_error_no_sections" };
    }
    if (!sections.cols.length) {
      return { ok: false, errorKey: "import_error_empty_section", params: { section: "COLS" } };
    }
    if (!sections.rows.length) {
      return { ok: false, errorKey: "import_error_empty_section", params: { section: "ROWS" } };
    }

    const rows = sections.rows.length;
    const cols = sections.cols.length;
    if (rows > MAX_DIMENSION || cols > MAX_DIMENSION) {
      return { ok: false, errorKey: "import_error_too_big", params: { rows, cols, max: MAX_DIMENSION } };
    }

    return {
      ok: true,
      scenario: { rows, cols, rowClues: sections.rows, colClues: sections.cols },
    };
  }

  /**
   * Lists every line whose clues can't physically fit in it
   * (sum of blocks + one mandatory gap between each pair > line length).
   * @param {Object} scenario
   * @returns {string[]} human-readable labels like "Fila 3"
   */
  function findOverflowingLines(scenario) {
    const labels = [];
    const check = (clues, total, labelKey) => {
      clues.forEach((values, index) => {
        const needed = values.reduce((a, b) => a + b, 0) + Math.max(0, values.length - 1);
        if (needed > total) {
          labels.push(`${app.i18n.t(labelKey)} ${index + 1}`);
        }
      });
    };
    check(scenario.rowClues, scenario.cols, "line_row");
    check(scenario.colClues, scenario.rows, "line_col");
    return labels;
  }

  /** Parses the textarea and, if valid, loads the result into the board. */
  function importFromTextarea() {
    const t = app.i18n.t;
    const text = elements.textarea.value;
    if (!text.trim()) {
      return;
    }

    const result = parse(text);
    if (!result.ok) {
      onMessage(t(result.errorKey, result.params), true);
      return;
    }

    const scenario = result.scenario;
    if (!app.Grid.loadScenario(scenario)) {
      onMessage(t("import_error_no_sections"), true);
      return;
    }

    onImported(scenario);

    let message = t("import_success", { rows: scenario.rows, cols: scenario.cols });
    const overflowing = findOverflowingLines(scenario);
    if (overflowing.length) {
      message += t("import_warning_lines", { count: overflowing.length, lines: overflowing.join(", ") });
    }
    onMessage(message, overflowing.length > 0);
  }

  /** @returns {string} the localized AI prompt, with real line breaks. */
  function getPrompt() {
    return app.i18n.t("import_prompt").replace(/\\n/g, "\n");
  }

  /** Copies the AI prompt to the clipboard, with a manual-select fallback. */
  function copyPrompt() {
    const t = app.i18n.t;
    const prompt = getPrompt();
    const done = () => onMessage(t("import_prompt_copied"), false);
    const fail = () => {
      elements.promptDetails.open = true;
      onMessage(t("import_prompt_copy_failed"), true);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(prompt).then(done, () => (copyWithSelection(prompt) ? done() : fail()));
      return;
    }
    if (copyWithSelection(prompt)) {
      done();
    } else {
      fail();
    }
  }

  /**
   * Fallback copy for http:// or file:// pages (or when the clipboard
   * permission is denied), via a hidden textarea + execCommand.
   * @param {string} text
   * @returns {boolean} whether the copy succeeded
   */
  function copyWithSelection(text) {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_error) {
      copied = false;
    }
    helper.remove();
    return copied;
  }

  /** (Re)applies every translated text of the import panel. */
  function applyTranslations() {
    const t = app.i18n.t;
    elements.summary.textContent = t("import_title");
    elements.hint.innerHTML = t("import_hint_html");
    elements.textarea.placeholder = t("import_placeholder").replace(/\\n/g, "\n");
    elements.textarea.setAttribute("aria-label", t("import_title"));
    elements.importBtn.textContent = t("import_btn");
    elements.copyBtn.textContent = t("import_copy_prompt_btn");
    elements.promptSummary.textContent = t("import_show_prompt");
    elements.promptText.textContent = getPrompt();
  }

  /**
   * @param {Object} options
   * @param {function(Object): void} options.onImported - called with the loaded scenario
   * @param {function(string, boolean): void} options.onMessage - (text, isError) for the info banner
   */
  function init(options) {
    onImported = options.onImported;
    onMessage = options.onMessage;

    elements = {
      summary: document.getElementById("import-summary"),
      hint: document.getElementById("import-hint"),
      textarea: document.getElementById("import-textarea"),
      importBtn: document.getElementById("import-btn"),
      copyBtn: document.getElementById("import-copy-prompt-btn"),
      promptDetails: document.getElementById("import-prompt-details"),
      promptSummary: document.getElementById("import-prompt-summary"),
      promptText: document.getElementById("import-prompt-text"),
    };

    applyTranslations();

    // Pasting loads the board right away; the button covers typed/edited text.
    elements.textarea.addEventListener("paste", () => {
      window.setTimeout(importFromTextarea, 0);
    });
    elements.importBtn.addEventListener("click", importFromTextarea);
    elements.copyBtn.addEventListener("click", copyPrompt);
  }

  app.TextImport = { init, applyTranslations, parse };
})(window.NonogramApp);
