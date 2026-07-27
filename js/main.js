/**
 * Application entry point.
 * Wires together the grid module, the rule registry and the DOM.
 */
window.CronogramApp = window.CronogramApp || {};

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
  let ruleCardElements = []; // [{ element, rule }]
  let loadedScenarios = []; // raw scenario objects, indexed same as <option> order

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

    app.Grid.init(document.getElementById("grid-wrapper"));
    app.Grid.onSelectionChange(updateActiveLineInfo);
    app.Grid.onActiveRulesChange(updateRuleCardsActiveState);
    app.Grid.generate(DEFAULT_ROWS, DEFAULT_COLS);

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
        console.error("No se pudieron cargar las plantillas de prueba:", error);
        scenarioSelect.innerHTML = "";
        scenarioSelect.appendChild(buildOption("", "No se pudieron cargar las plantillas"));
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

  /** Fills the dropdown with the scenarios fetched from the manifest. */
  function populateScenarioSelect() {
    scenarioSelect.innerHTML = "";
    scenarioSelect.appendChild(buildOption("", "Elige una plantilla…"));

    loadedScenarios.forEach((scenario, index) => {
      const label = `${scenario.name} (${scenario.rows}×${scenario.cols})`;
      scenarioSelect.appendChild(buildOption(String(index), label));
    });

    scenarioSelect.disabled = false;
    updateLoadScenarioBtnState();
  }

  /** Enables the "Cargar" button only once an actual scenario is selected. */
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
      activeLineInfoElement.textContent = `No se pudo cargar la plantilla "${scenario.name}".`;
      activeLineInfoElement.classList.add("is-invalid");
      return;
    }

    rowsInput.value = String(scenario.rows);
    colsInput.value = String(scenario.cols);

    updateActiveLineInfo(null);
    updateRuleCardsActiveState(new Set());
    activeLineInfoElement.textContent = `Plantilla "${scenario.name}" cargada.`;
    activeLineInfoElement.classList.remove("is-invalid");
  }

  /**
   * Formats a plain-text math condition (e.g. "total/2 < n < total")
   * into HTML where the variable tokens are wrapped in <em>, following
   * the classic math-typesetting convention: variables in italics,
   * operators and numbers upright. The input always comes from our own
   * rule files, never from user input, so building HTML this way is safe.
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
      title.textContent = rule.name;

      body.appendChild(title);

      if (rule.condition) {
        const formula = document.createElement("p");
        formula.className = "rule-card__formula";
        formula.innerHTML = formatMathCondition(rule.condition);
        body.appendChild(formula);
      }

      const hint = document.createElement("p");
      hint.className = "rule-card__hint";
      hint.textContent = rule.hint || "";
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
   * (a brief flash on the card) plus a status message.
   * @param {Object} rule
   * @param {HTMLElement} cardElement
   */
  function handleRuleClick(rule, cardElement) {
    const result = app.Grid.toggleRule(rule);

    cardElement.classList.add("is-flash");
    window.setTimeout(() => cardElement.classList.remove("is-flash"), FLASH_DURATION_MS);

    activeLineInfoElement.textContent = result.message;
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
      return;
    }

    const lineLabel = selection.type === "row" ? "Fila" : "Columna";
    const cluesLabel = selection.clueValues.length ? selection.clueValues.join(" ") : "sin definir";

    let message =
      `${lineLabel} ${selection.index + 1} · pistas: ${cluesLabel} · ` +
      `suma = ${selection.sum} · longitud = ${selection.total}`;

    if (!selection.isValid) {
      message += " · ¡la suma de las pistas supera la longitud de la línea!";
    }

    activeLineInfoElement.textContent = message;
    activeLineInfoElement.classList.toggle("is-invalid", !selection.isValid);
  }

  /**
   * Highlights every rule card whose rule is currently toggled on
   * board-wide, and unhighlights the rest.
   * @param {Set<string>} activeRuleIds
   */
  function updateRuleCardsActiveState(activeRuleIds) {
    ruleCardElements.forEach(({ element, rule }) => {
      const isActive = activeRuleIds.has(rule.id);
      element.classList.toggle("is-active", isActive);
      element.setAttribute("aria-pressed", String(isActive));
    });
  }

  /**
   * Reads whatever is directly under the cursor (a cell or a header)
   * and builds the "Fila X" / "Columna Y" / "Fila X, Columna Y" label,
   * or null if the cursor isn't over anything with a known coordinate
   * (e.g. the empty corner square, or the gaps between cells).
   * @param {HTMLElement} target
   * @returns {string|null}
   */
  function buildHoverCoordinateLabel(target) {
    const cell = target.closest(".grid-cell");
    if (cell) {
      const row = Number(cell.dataset.row) + 1;
      const col = Number(cell.dataset.col) + 1;
      return `Fila ${row}, Columna ${col}`;
    }

    const header = target.closest(".line-header");
    if (header) {
      const index = Number(header.dataset.lineIndex) + 1;
      return header.dataset.lineType === "row" ? `Fila ${index}` : `Columna ${index}`;
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
})(window.CronogramApp);
