/**
 * Application entry point.
 * Wires together the grid module, the rule registry, the i18n engine
 * and the DOM.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const DEFAULT_ROWS = 10;
  const DEFAULT_COLS = 10;
  const FLASH_DURATION_MS = 250;
  const SCENARIOS_URL = "json/scenarios.json";

  let rowsInput;
  let colsInput;
  let gridConfigForm;
  let clearGridBtn;
  let rulesListElement;
  let activeLineInfoElement;
  let scenarioSelect;
  let loadScenarioBtn;
  let hoverCoordinateElement;
  let gridWrapperElement;
  let localeSelect;

  // Static elements whose text is translated on load and on locale change.
  let appTitleElement;
  let appSubtitleElement;
  let boardPanelElement;
  let boardPanelTitleElement;
  let rowsLabelElement;
  let colsLabelElement;
  let generateGridBtn;
  let scenarioLabelElement;
  let gridInstructionsElement;
  let rulesPanelElement;
  let rulesPanelTitleElement;
  let rulesHintElement;
  let legendTitleElement;
  let legendNElement;
  let legendTotalElement;
  let legendKElement;
  let legendPElement;
  let legendSigmaElement;

  let ruleCardElements = []; // [{ element, rule }]
  let loadedScenarios = []; // raw scenario objects, indexed same as <option> order
  let currentActiveRuleIds = new Set(); // kept in sync so cards can be rebuilt on locale change

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    rowsInput = document.getElementById("rows-input");
    colsInput = document.getElementById("cols-input");
    gridConfigForm = document.getElementById("grid-config-form");
    clearGridBtn = document.getElementById("clear-grid-btn");
    rulesListElement = document.getElementById("rules-list");
    activeLineInfoElement = document.getElementById("active-line-info");
    scenarioSelect = document.getElementById("scenario-select");
    loadScenarioBtn = document.getElementById("load-scenario-btn");
    hoverCoordinateElement = document.getElementById("hover-coordinate");
    gridWrapperElement = document.getElementById("grid-wrapper");
    localeSelect = document.getElementById("locale-select");

    appTitleElement = document.getElementById("app-title");
    appSubtitleElement = document.getElementById("app-subtitle");
    boardPanelElement = document.getElementById("board-panel");
    boardPanelTitleElement = document.getElementById("board-panel-title");
    rowsLabelElement = document.getElementById("rows-label");
    colsLabelElement = document.getElementById("cols-label");
    generateGridBtn = document.getElementById("generate-grid-btn");
    scenarioLabelElement = document.getElementById("scenario-label");
    gridInstructionsElement = document.getElementById("grid-instructions");
    rulesPanelElement = document.getElementById("rules-panel");
    rulesPanelTitleElement = document.getElementById("rules-panel-title");
    rulesHintElement = document.getElementById("rules-hint");
    legendTitleElement = document.getElementById("legend-title");
    legendNElement = document.getElementById("legend-n");
    legendTotalElement = document.getElementById("legend-total");
    legendKElement = document.getElementById("legend-k");
    legendPElement = document.getElementById("legend-p");
    legendSigmaElement = document.getElementById("legend-sigma");

    // Everything below reads translated text (rule cards, static
    // labels, aria-labels grid.js sets while building cells...), so it
    // all waits for language/translations.csv to finish loading first.
    // The raw Spanish text already sitting in the HTML acts as the
    // "loading" state in the meantime — see i18n.js's `load()` docs
    // for what happens if the fetch itself fails.
    app.i18n.load().then(startApp);
  }

  /** Runs once `language/translations.csv` has loaded (or failed to). */
  function startApp() {
    app.Grid.init(document.getElementById("grid-wrapper"));
    app.Grid.onSelectionChange(updateActiveLineInfo);
    app.Grid.onActiveRulesChange(updateRuleCardsActiveState);
    app.Grid.generate(DEFAULT_ROWS, DEFAULT_COLS);

    applyStaticTranslations();
    populateLocaleSelect();
    renderRuleCards();
    updateActiveLineInfo(null);
    updateRuleCardsActiveState(new Set());

    gridConfigForm.addEventListener("submit", handleGenerateGrid);
    clearGridBtn.addEventListener("click", () => {
      app.Grid.clearColors();
    });

    scenarioSelect.addEventListener("change", updateLoadScenarioBtnState);
    loadScenarioBtn.addEventListener("click", handleLoadScenarioClick);
    loadScenarios();

    gridWrapperElement.addEventListener("mousemove", handleGridMouseMove);
    gridWrapperElement.addEventListener("mouseleave", hideHoverCoordinate);

    localeSelect.addEventListener("change", () => {
      app.i18n.setLocale(localeSelect.value);
    });
    app.i18n.onLocaleChange(handleLocaleChange);
  }

  /**
   * Reads the size inputs and rebuilds the board.
   * @param {SubmitEvent} event
   */
  function handleGenerateGrid(event) {
    event.preventDefault();

    const rows = clampDimension(parseInt(rowsInput.value, 10));
    const cols = clampDimension(parseInt(colsInput.value, 10));

    rowsInput.value = String(rows);
    colsInput.value = String(cols);

    app.Grid.generate(rows, cols);
    updateActiveLineInfo(null);
    updateRuleCardsActiveState(new Set());
  }

  /**
   * Keeps the grid dimensions within a sane, renderable range.
   * @param {number} value
   * @returns {number}
   */
  function clampDimension(value) {
    if (Number.isNaN(value)) {
      return DEFAULT_ROWS;
    }
    return Math.min(25, Math.max(1, value));
  }

  /**
   * Sets the text of every static (non-dynamically-generated) UI
   * element from the current locale's dictionary. Called once at
   * startup and again every time the locale changes.
   */
  function applyStaticTranslations() {
    const t = app.i18n.t;

    document.documentElement.lang = app.i18n.getLocale();
    document.title = t("app_title");

    appTitleElement.textContent = t("app_title");
    appSubtitleElement.textContent = t("app_subtitle");

    boardPanelElement.setAttribute("aria-label", t("board_panel_aria_label"));
    boardPanelTitleElement.textContent = t("board_panel_title");
    rowsLabelElement.textContent = t("board_rows_label");
    colsLabelElement.textContent = t("board_cols_label");
    generateGridBtn.textContent = t("board_generate_btn");
    clearGridBtn.textContent = t("board_clear_all_btn");

    scenarioLabelElement.textContent = t("scenario_label");
    loadScenarioBtn.textContent = t("scenario_load_btn");

    gridInstructionsElement.innerHTML = t("board_instructions_html");

    rulesPanelElement.setAttribute("aria-label", t("rules_panel_aria_label"));
    rulesPanelTitleElement.textContent = t("rules_panel_title");
    rulesHintElement.innerHTML = t("rules_hint_html");

    legendTitleElement.textContent = t("legend_title");
    legendNElement.textContent = t("legend_n");
    legendTotalElement.textContent = t("legend_total");
    legendKElement.textContent = t("legend_k");
    legendPElement.textContent = t("legend_p");
    legendSigmaElement.textContent = t("legend_sigma");

    // The scenario dropdown's placeholder/loading text only gets
    // rebuilt here if scenarios haven't loaded yet (or failed) — once
    // real scenarios are loaded, populateScenarioSelect() owns it and
    // gets called again below in handleLocaleChange.
    if (!loadedScenarios.length && scenarioSelect.options.length) {
      scenarioSelect.options[0].textContent = scenarioSelect.disabled
        ? t("scenario_load_error_option")
        : t("scenario_loading");
    }
  }

  /** Fills the language dropdown and selects whatever locale is currently active. */
  function populateLocaleSelect() {
    localeSelect.innerHTML = "";
    app.i18n.getSupportedLocales().forEach((locale) => {
      const option = document.createElement("option");
      option.value = locale;
      option.textContent = app.i18n.getLocaleDisplayName(locale);
      localeSelect.appendChild(option);
    });
    localeSelect.value = app.i18n.getLocale();
  }

  /**
   * Re-renders everything whose text depends on the language whenever
   * it changes. Deliberately does NOT touch whatever message is
   * currently showing in the info banner (a just-triggered "rule
   * activated" or "scenario loaded" message stays as-is) — only the
   * next action will show up in the new language. Retranslating a
   * transient status message after the fact isn't worth the added
   * bookkeeping.
   * @param {string} _locale
   */
  function handleLocaleChange(_locale) {
    applyStaticTranslations();
    populateLocaleSelect();
    renderRuleCards();
    updateRuleCardsActiveState(currentActiveRuleIds);
    if (loadedScenarios.length) {
      populateScenarioSelect();
    }
  }

  /**
   * Fetches the read-only test-scenario manifest and fills the
   * dropdown with one option per scenario. If it fails (e.g. opened
   * without a local server), the dropdown is left disabled with an
   * explanatory placeholder instead of breaking the rest of the app.
   */
  function loadScenarios() {
    fetch(SCENARIOS_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        loadedScenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
        populateScenarioSelect();
      })
      .catch((error) => {
        console.error(app.i18n.t("scenario_load_error_console"), error);
        scenarioSelect.innerHTML = "";
        scenarioSelect.appendChild(buildOption("", app.i18n.t("scenario_load_error_option")));
        scenarioSelect.disabled = true;
      });
  }

  /**
   * @param {string} value
   * @param {string} label
   * @returns {HTMLOptionElement}
   */
  function buildOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  /**
   * Fills the dropdown with the scenarios fetched from the manifest.
   * Note: each scenario's own `name` comes straight from
   * `json/scenarios.json` and is only ever written in Spanish — the
   * read-only test scenarios aren't localized (see README_TECH.md).
   */
  function populateScenarioSelect() {
    scenarioSelect.innerHTML = "";
    scenarioSelect.appendChild(buildOption("", app.i18n.t("scenario_placeholder")));

    loadedScenarios.forEach((scenario, index) => {
      const label = `${scenario.name} (${scenario.rows}×${scenario.cols})`;
      scenarioSelect.appendChild(buildOption(String(index), label));
    });

    scenarioSelect.disabled = false;
    updateLoadScenarioBtnState();
  }

  /** Enables the "load" button only once an actual scenario is selected. */
  function updateLoadScenarioBtnState() {
    loadScenarioBtn.disabled = scenarioSelect.value === "";
  }

  /** Loads whichever scenario is currently selected into the board. */
  function handleLoadScenarioClick() {
    const scenario = loadedScenarios[Number(scenarioSelect.value)];
    if (!scenario) {
      return;
    }

    const wasLoaded = app.Grid.loadScenario(scenario);
    if (!wasLoaded) {
      activeLineInfoElement.textContent = app.i18n.t("scenario_not_loaded", { name: scenario.name });
      activeLineInfoElement.classList.add("is-invalid");
      return;
    }

    rowsInput.value = String(scenario.rows);
    colsInput.value = String(scenario.cols);

    updateActiveLineInfo(null);
    updateRuleCardsActiveState(new Set());
    activeLineInfoElement.textContent = app.i18n.t("scenario_loaded", { name: scenario.name });
    activeLineInfoElement.classList.remove("is-invalid");
  }

  /**
   * Formats a plain-text math condition (e.g. "total/2 < n < total")
   * into HTML where the variable tokens are wrapped in <em>, following
   * the classic math-typesetting convention: variables in italics,
   * operators and numbers upright. The input always comes from our own
   * rule files, never from user input, so building HTML this way is
   * safe. Conditions are never translated (see ruleManager.js) — the
   * variable names (n, total, k, p, Σ) read the same in every
   * supported language.
   * @param {string} condition
   * @returns {string}
   */
  function formatMathCondition(condition) {
    return condition.replace(/total/g, "<em>total</em>").replace(/\bn\b/g, "<em>n</em>");
  }

  /** Builds one clickable toggle card per registered rule in the right-hand panel. */
  function renderRuleCards() {
    rulesListElement.innerHTML = "";
    ruleCardElements = [];

    app.rules.forEach((rule, position) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "rule-card";
      card.setAttribute("aria-pressed", "false");
      card.style.setProperty("--rule-color", rule.color);

      const indexLabel = document.createElement("span");
      indexLabel.className = "rule-card__index";
      indexLabel.textContent = String(position + 1).padStart(2, "0");

      const body = document.createElement("span");
      body.className = "rule-card__body";

      const title = document.createElement("h3");
      title.textContent = app.i18n.t(rule.name);

      body.appendChild(title);

      if (rule.condition) {
        const formula = document.createElement("p");
        formula.className = "rule-card__formula";
        formula.innerHTML = formatMathCondition(rule.condition);
        body.appendChild(formula);
      }

      const hint = document.createElement("p");
      hint.className = "rule-card__hint";
      hint.textContent = app.i18n.t(rule.hint) || "";
      body.appendChild(hint);

      card.appendChild(indexLabel);
      card.appendChild(body);

      card.addEventListener("click", () => handleRuleClick(rule, card));

      rulesListElement.appendChild(card);
      ruleCardElements.push({ element: card, rule });
    });
  }

  /**
   * Toggles a rule on/off board-wide and gives quick visual feedback
   * (a brief flash on the card) plus a status message, built here
   * (not in grid.js) from the structured result + the rule's own
   * localized name, since that's where `app.i18n` naturally lives.
   * @param {Object} rule
   * @param {HTMLElement} cardElement
   */
  function handleRuleClick(rule, cardElement) {
    const result = app.Grid.toggleRule(rule);

    cardElement.classList.add("is-flash");
    window.setTimeout(() => cardElement.classList.remove("is-flash"), FLASH_DURATION_MS);

    const name = app.i18n.t(rule.name);
    const message = result.isActiveNow
      ? app.i18n.t(result.appliedCount === 1 ? "rule_activated_one" : "rule_activated_other", {
          name,
          count: result.appliedCount,
        })
      : app.i18n.t("rule_deactivated", { name });

    activeLineInfoElement.textContent = message;
    activeLineInfoElement.classList.remove("is-invalid");
  }

  /**
   * Updates the info banner with the line currently open in the clue
   * editor (this no longer affects which rules can be applied — rules
   * are board-wide toggles now).
   * @param {{type: "row"|"col", index: number, clueValues: number[], sum: number, total: number, isValid: boolean}|null} selection
   */
  function updateActiveLineInfo(selection) {
    if (!selection) {
      activeLineInfoElement.textContent = app.i18n.t("board_select_prompt");
      return;
    }

    const lineLabel = selection.type === "row" ? app.i18n.t("line_row") : app.i18n.t("line_col");
    const cluesLabel = selection.clueValues.length ? selection.clueValues.join(" ") : app.i18n.t("line_undefined");

    let message = app.i18n.t("line_info", {
      lineLabel,
      index: selection.index + 1,
      clues: cluesLabel,
      sum: selection.sum,
      total: selection.total,
    });

    if (!selection.isValid) {
      message += app.i18n.t("line_sum_exceeds");
    }

    activeLineInfoElement.textContent = message;
    activeLineInfoElement.classList.toggle("is-invalid", !selection.isValid);
  }

  /**
   * Highlights every rule card whose rule is currently toggled on
   * board-wide, and unhighlights the rest. Also remembers the set so
   * it can be re-applied after `renderRuleCards()` rebuilds the cards
   * from scratch (e.g. on a locale change).
   * @param {Set<string>} activeRuleIds
   */
  function updateRuleCardsActiveState(activeRuleIds) {
    currentActiveRuleIds = activeRuleIds;
    ruleCardElements.forEach(({ element, rule }) => {
      const isActive = activeRuleIds.has(rule.id);
      element.classList.toggle("is-active", isActive);
      element.setAttribute("aria-pressed", String(isActive));
    });
  }

  /**
   * Reads whatever is directly under the cursor (a cell or a header)
   * and builds the "Row X" / "Column Y" / "Row X, Column Y" label (in
   * the current language), or null if the cursor isn't over anything
   * with a known coordinate (e.g. the empty corner square, or the gaps
   * between cells).
   * @param {HTMLElement} target
   * @returns {string|null}
   */
  function buildHoverCoordinateLabel(target) {
    const cell = target.closest(".grid-cell");
    if (cell) {
      const row = Number(cell.dataset.row) + 1;
      const col = Number(cell.dataset.col) + 1;
      return `${app.i18n.t("line_row")} ${row}, ${app.i18n.t("line_col")} ${col}`;
    }

    const header = target.closest(".line-header");
    if (header) {
      const index = Number(header.dataset.lineIndex) + 1;
      const label = header.dataset.lineType === "row" ? app.i18n.t("line_row") : app.i18n.t("line_col");
      return `${label} ${index}`;
    }

    return null;
  }

  /**
   * Moves the floating coordinate label to follow the cursor and keeps
   * its text in sync with whatever cell/header is directly underneath.
   * Hides it entirely when hovering the empty corner or the gaps
   * between cells, so it never shows a stale or meaningless label.
   * @param {MouseEvent} event
   */
  function handleGridMouseMove(event) {
    const label = buildHoverCoordinateLabel(event.target);

    if (!label) {
      hideHoverCoordinate();
      return;
    }

    hoverCoordinateElement.textContent = label;
    hoverCoordinateElement.style.left = `${event.clientX}px`;
    hoverCoordinateElement.style.top = `${event.clientY}px`;
    hoverCoordinateElement.classList.add("is-visible");
  }

  /** Hides the floating coordinate label (cursor left the board, or is over empty space within it). */
  function hideHoverCoordinate() {
    hoverCoordinateElement.classList.remove("is-visible");
  }
})(window.NonogramApp);
