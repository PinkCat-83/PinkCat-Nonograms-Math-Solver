/**
 * Grid module.
 *
 * Owns the puzzle board: building it, storing the clue numbers typed
 * by the user for each line (through the clue editor popup), and
 * keeping track of which rules are globally toggled on so it can
 * sweep the *entire* board (every row and every column) and repaint
 * it from scratch whenever anything relevant changes: a rule is
 * toggled, a line's clues are edited, or the board is regenerated.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const CELL_SIZE_PX = 30;
  const BAND_SIZE = 5; // every this many rows/columns gets a stronger separator

  /** Internal state of the board. */
  const state = {
    rowCount: 0,
    colCount: 0,
    selectedLine: null, // { type: "row" | "col", index: number } - only used for the clue editor popup
    cellElements: [], // cellElements[row][col] -> HTMLElement
    rowClues: [], // rowClues[row] -> number[]
    colClues: [], // colClues[col] -> number[]
    rowHeaderWrappers: [], // rowHeaderWrappers[row] -> HTMLElement (whole header cell)
    colHeaderWrappers: [], // colHeaderWrappers[col] -> HTMLElement (whole header cell)
    activeRuleIds: new Set(), // rule ids currently toggled ON, applied board-wide
    manualMarks: [], // manualMarks[row][col] -> "filled" | "cross" | null, set by hand with the mouse
  };

  let gridWrapperElement = null;
  let onSelectionChangeCallback = null;
  let onActiveRulesChangeCallback = null;

  // Ephemeral drag-painting state (not board data, so it lives outside `state`).
  let isManualDragging = false;
  let manualDragValue = null; // "filled" | "cross" | null — applied to every cell the drag touches
  let lastDraggedCellKey = null;

  /**
   * Builds a fresh board with the given dimensions.
   * @param {number} rowCount
   * @param {number} colCount
   */
  function generate(rowCount, colCount) {
    state.rowCount = rowCount;
    state.colCount = colCount;
    state.selectedLine = null;
    state.cellElements = [];
    state.rowClues = Array.from({ length: rowCount }, () => []);
    state.colClues = Array.from({ length: colCount }, () => []);
    state.rowHeaderWrappers = [];
    state.colHeaderWrappers = [];
    state.activeRuleIds = new Set();
    state.manualMarks = Array.from({ length: rowCount }, () => new Array(colCount).fill(null));

    gridWrapperElement.innerHTML = "";

    const gridElement = document.createElement("div");
    gridElement.className = "crono-grid";
    // Header row/column are "auto" sized so they grow to fit however many
    // clue numbers the longest row/column header currently displays.
    gridElement.style.gridTemplateColumns = `auto repeat(${colCount}, ${CELL_SIZE_PX}px)`;
    gridElement.style.gridTemplateRows = `auto repeat(${rowCount}, ${CELL_SIZE_PX}px)`;

    // Top-left empty corner.
    const corner = document.createElement("div");
    corner.className = "grid-corner";
    gridElement.appendChild(corner);

    // Column headers: clue numbers displayed stacked vertically.
    for (let col = 0; col < colCount; col += 1) {
      const header = buildLineHeader("col", col, colCount);
      gridElement.appendChild(header.wrapper);
      state.colHeaderWrappers.push(header.wrapper);
      renderClueDisplay("col", col);
    }

    // Body rows: row header (clues side by side) + cells.
    for (let row = 0; row < rowCount; row += 1) {
      const rowHeader = buildLineHeader("row", row, rowCount);
      gridElement.appendChild(rowHeader.wrapper);
      state.rowHeaderWrappers.push(rowHeader.wrapper);
      renderClueDisplay("row", row);

      const cellRow = [];
      for (let col = 0; col < colCount; col += 1) {
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        applyBandBoundaryClasses(cell, "grid-cell--col-band-end", col, colCount);
        applyBandBoundaryClasses(cell, "grid-cell--row-band-end", row, rowCount);
        gridElement.appendChild(cell);
        cellRow.push(cell);
      }
      state.cellElements.push(cellRow);
    }

    gridWrapperElement.appendChild(gridElement);
  }

  /**
   * Adds a "band end" class to an element when `index` sits on a
   * every-BAND_SIZE boundary (and isn't the very last line, which is
   * already bounded by the grid's own outer border).
   * @param {HTMLElement} element
   * @param {string} className
   * @param {number} index
   * @param {number} count
   */
  function applyBandBoundaryClasses(element, className, index, count) {
    const isBandBoundary = (index + 1) % BAND_SIZE === 0 && index !== count - 1;
    if (isBandBoundary) {
      element.classList.add(className);
    }
  }

  /**
   * Builds a clickable header cell for a line. It only displays the
   * clue numbers already set; clicking (or pressing Enter/Space on it)
   * opens the clue editor popup to type or change them.
   * @param {"row"|"col"} type
   * @param {number} index
   * @param {number} count - total number of lines of this type, for banding
   * @returns {{wrapper: HTMLElement, displayContainer: HTMLElement}}
   */
  function buildLineHeader(type, index, count) {
    const wrapper = document.createElement("div");
    wrapper.className = "line-header";
    wrapper.dataset.lineType = type;
    wrapper.dataset.lineIndex = String(index);
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "button");
    wrapper.setAttribute(
      "aria-label",
      type === "row"
        ? app.i18n.t("aria_edit_row", { index: index + 1 })
        : app.i18n.t("aria_edit_col", { index: index + 1 })
    );

    const bandClassName = type === "row" ? "line-header--row-band-end" : "line-header--col-band-end";
    applyBandBoundaryClasses(wrapper, bandClassName, index, count);
    if (Math.floor(index / BAND_SIZE) % 2 === 1) {
      wrapper.classList.add("line-header--alt-band");
    }

    const displayContainer = document.createElement("div");
    displayContainer.className =
      type === "row" ? "clue-display clue-display--horizontal" : "clue-display clue-display--vertical";
    wrapper.appendChild(displayContainer);

    wrapper.addEventListener("click", () => openClueEditorForLine(type, index));
    wrapper.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openClueEditorForLine(type, index);
      }
    });

    return { wrapper, displayContainer };
  }

  /**
   * Opens the clue editor popup for a line, pre-filled with its current
   * numbers, and wires up what happens when the person accepts changes.
   * Marks the line as selected purely so the info banner can describe
   * it; painting no longer depends on any single "selected" line.
   * @param {"row"|"col"} type
   * @param {number} index
   */
  function openClueEditorForLine(type, index) {
    selectLine(type, index);

    const total = type === "row" ? state.colCount : state.rowCount;
    const lineLabel =
      type === "row"
        ? `${app.i18n.t("line_row")} ${index + 1}`
        : `${app.i18n.t("line_col")} ${index + 1}`;

    app.ClueEditor.open({
      title: app.i18n.t("clue_editor_title_for_line", { lineLabel }),
      initialValues: getClueValues(type, index),
      total,
      onConfirm(values) {
        if (type === "row") {
          state.rowClues[index] = values;
        } else {
          state.colClues[index] = values;
        }
        renderClueDisplay(type, index);
        // Clues changed, so every active rule needs to be re-checked
        // against the whole board, not just this line.
        repaintBoard();
        notifySelectionChange();
      },
    });
  }

  /**
   * Redraws the small clue chips shown inside a header cell, and
   * refreshes its invalid/valid styling.
   * @param {"row"|"col"} type
   * @param {number} index
   */
  function renderClueDisplay(type, index) {
    const wrapper = type === "row" ? state.rowHeaderWrappers[index] : state.colHeaderWrappers[index];
    const displayContainer = wrapper.querySelector(".clue-display");
    const values = getClueValues(type, index);

    displayContainer.innerHTML = "";

    if (values.length === 0) {
      const placeholder = document.createElement("span");
      placeholder.className = "clue-chip clue-chip--placeholder";
      placeholder.textContent = "–";
      displayContainer.appendChild(placeholder);
    } else {
      values.forEach((value) => {
        const chip = document.createElement("span");
        chip.className = "clue-chip";
        chip.textContent = String(value);
        displayContainer.appendChild(chip);
      });
    }

    updateLineValidity(type, index);
  }

  /**
   * Marks a row or column as the selected line (for the clue editor and
   * the info banner only — it has no effect on which cells get painted).
   * @param {"row"|"col"} type
   * @param {number} index
   */
  function selectLine(type, index) {
    state.selectedLine = { type, index };

    state.rowHeaderWrappers.forEach((el, i) => {
      el.classList.toggle("is-selected", type === "row" && i === index);
    });
    state.colHeaderWrappers.forEach((el, i) => {
      el.classList.toggle("is-selected", type === "col" && i === index);
    });

    notifySelectionChange();
  }

  /**
   * Toggles the "is-invalid" style on a header when the sum of its
   * clue numbers exceeds the total length of the line.
   * @param {"row"|"col"} type
   * @param {number} index
   */
  function updateLineValidity(type, index) {
    const wrapper = type === "row" ? state.rowHeaderWrappers[index] : state.colHeaderWrappers[index];
    const total = type === "row" ? state.colCount : state.rowCount;
    const sum = sumClueValues(getClueValues(type, index));

    if (wrapper) {
      wrapper.classList.toggle("is-invalid", sum > total);
    }
  }

  /**
   * Reads the clue numbers currently stored for a line.
   * @param {"row"|"col"} type
   * @param {number} index
   * @returns {number[]}
   */
  function getClueValues(type, index) {
    const values = type === "row" ? state.rowClues[index] : state.colClues[index];
    return values || [];
  }

  /**
   * @param {number[]} values
   * @returns {number}
   */
  function sumClueValues(values) {
    return values.reduce((accumulator, value) => accumulator + value, 0);
  }

  /**
   * @returns {{type: "row"|"col", index: number, clueValues: number[], sum: number, total: number, isValid: boolean}|null}
   */
  function getSelectionSummary() {
    if (!state.selectedLine) {
      return null;
    }

    const { type, index } = state.selectedLine;
    const clueValues = getClueValues(type, index);
    const total = type === "row" ? state.colCount : state.rowCount;
    const sum = sumClueValues(clueValues);

    return { type, index, clueValues, sum, total, isValid: sum <= total };
  }

  /** Fires the selection-change callback with a fresh summary, if any is registered. */
  function notifySelectionChange() {
    if (typeof onSelectionChangeCallback === "function") {
      onSelectionChangeCallback(getSelectionSummary());
    }
  }

  /** Fires the active-rules callback with the current set, if any is registered. */
  function notifyActiveRulesChange(appliedCounts) {
    if (typeof onActiveRulesChangeCallback === "function") {
      onActiveRulesChangeCallback(new Set(state.activeRuleIds), appliedCounts);
    }
  }

  /**
   * Toggles a rule on or off board-wide, then sweeps the *entire* board
   * (every row and every column) and repaints it from scratch using
   * every currently active rule. This is the only way lines get
   * painted now — there is no notion of a single "active line" rule
   * application anymore.
   *
   * Returns structured data rather than a ready-made message: `rule.name`
   * is a localized `{es, en, fr}` object now, not a plain string, so
   * building the user-facing text is main.js's job (it has `app.i18n`
   * readily on hand for that), not grid.js's.
   * @param {Object} rule - rule object from the rule registry
   * @returns {{success: boolean, isActiveNow: boolean, appliedCount: number}} feedback for the UI
   */
  function toggleRule(rule) {
    const wasActive = state.activeRuleIds.has(rule.id);

    if (wasActive) {
      state.activeRuleIds.delete(rule.id);
    } else {
      state.activeRuleIds.add(rule.id);
    }

    const appliedCounts = repaintBoard();
    const appliedCount = appliedCounts.get(rule.id) || 0;
    notifyActiveRulesChange(appliedCounts);

    return { success: true, isActiveNow: !wasActive, appliedCount };
  }

  /**
   * Clears every cell and repaints the whole board from scratch: for
   * every currently active rule (in registration order), for every row
   * and then every column, checks whether that line's clue numbers are
   * valid (sum ≤ total) and satisfy the rule's own applicability check
   * — single-clue rules only look at lines with exactly one clue,
   * multi-clue rules (see `sweepDimension`) can look at lines with any
   * number of clues — and if so paints it. Rules later in the list can
   * overwrite cells painted by earlier ones where their masks overlap.
   * @returns {Map<string, number>} number of lines each active rule painted
   */
  function repaintBoard() {
    clearAllCellColors();

    const appliedCounts = new Map();

    app.rules.forEach((rule) => {
      if (!state.activeRuleIds.has(rule.id)) {
        return;
      }

      let appliedCount = 0;
      appliedCount += sweepDimension(rule, "row", state.rowCount, state.colCount);
      appliedCount += sweepDimension(rule, "col", state.colCount, state.rowCount);
      appliedCounts.set(rule.id, appliedCount);
    });

    return appliedCounts;
  }

  /**
   * Applies one rule across every line of one dimension (all rows, or
   * all columns), painting each line that qualifies.
   *
   * Two rule "shapes" are supported, chosen via the rule's own
   * `supportsMultipleClues` flag:
   *   - Single-clue rules (default, e.g. "Norma completa"): only ever
   *     looked at when the line has exactly one clue number. They keep
   *     receiving `(n, total)` exactly as before — untouched contract.
   *   - Multi-clue rules (`supportsMultipleClues: true`, e.g. "Norma 3"):
   *     receive the *whole* clue array for the line, `(clueValues, total)`,
   *     whatever its length (1, 2, 3...). The rule itself decides via its
   *     own `isApplicable` how many clues it wants to react to.
   * @param {Object} rule
   * @param {"row"|"col"} type
   * @param {number} count - number of lines of this type
   * @param {number} total - length of each such line
   * @returns {number} how many lines were painted
   */
  function sweepDimension(rule, type, count, total) {
    let appliedCount = 0;

    for (let index = 0; index < count; index += 1) {
      const clueValues = getClueValues(type, index);
      const sum = sumClueValues(clueValues);
      const isValid = sum <= total;

      if (clueValues.length === 0 || !isValid) {
        continue;
      }

      let isApplicable;
      let mask;

      if (rule.supportsMultipleClues) {
        isApplicable = rule.isApplicable(clueValues, total);
        if (isApplicable) {
          mask = rule.computePaintMask(clueValues, total);
        }
      } else {
        if (clueValues.length !== 1) {
          continue;
        }
        const n = clueValues[0];
        isApplicable = rule.isApplicable(n, total);
        if (isApplicable) {
          mask = rule.computePaintMask(n, total);
        }
      }

      if (!isApplicable) {
        continue;
      }

      paintLine(type, index, mask, rule.color);
      appliedCount += 1;
    }

    return appliedCount;
  }

  /**
   * Paints the cells of a line according to a boolean mask.
   * @param {"row"|"col"} type
   * @param {number} index
   * @param {boolean[]} mask
   * @param {string} color
   */
  function paintLine(type, index, mask, color) {
    mask.forEach((shouldPaint, position) => {
      if (!shouldPaint) {
        return;
      }
      const cell = type === "row" ? state.cellElements[index][position] : state.cellElements[position][index];
      if (cell) {
        cell.style.backgroundColor = color;
        // Marks the cell as "claimed" by an active rule this repaint, so
        // manual marks know to hide their own visual on top of it (rules
        // take visual priority over hand-drawn marks — see setManualMark).
        cell.classList.add("is-rule-painted");
      }
    });
  }

  /** Clears the color of every cell, without touching which rules are toggled on. */
  function clearAllCellColors() {
    state.cellElements.forEach((row) => {
      row.forEach((cell) => {
        cell.style.backgroundColor = "";
        cell.classList.remove("is-rule-painted");
      });
    });
  }

  /** Turns every rule off and clears all painted cells. */
  function clearColors() {
    state.activeRuleIds.clear();
    clearAllCellColors();
    notifyActiveRulesChange(new Map());
  }

  /**
   * Rebuilds the board at the scenario's size and pre-fills every row
   * and column with its clue numbers. Used by the read-only test-scenario
   * dropdown. No rules are left active afterwards, same as a plain
   * "Generar tablero" — the person still has to toggle the rules they
   * want to see applied.
   * @param {{rows: number, cols: number, rowClues: number[][], colClues: number[][]}} scenario
   * @returns {boolean} whether the scenario was valid and got loaded
   */
  function loadScenario(scenario) {
    const isShapeValid =
      scenario &&
      Number.isInteger(scenario.rows) &&
      Number.isInteger(scenario.cols) &&
      Array.isArray(scenario.rowClues) &&
      Array.isArray(scenario.colClues) &&
      scenario.rowClues.length === scenario.rows &&
      scenario.colClues.length === scenario.cols;

    if (!isShapeValid) {
      console.error("Invalid scenario, skipped:", scenario);
      return false;
    }

    generate(scenario.rows, scenario.cols);

    state.rowClues = scenario.rowClues.map((values) => values.slice());
    state.colClues = scenario.colClues.map((values) => values.slice());

    for (let row = 0; row < state.rowCount; row += 1) {
      renderClueDisplay("row", row);
    }
    for (let col = 0; col < state.colCount; col += 1) {
      renderClueDisplay("col", col);
    }

    return true;
  }

  /**
   * Registers a callback fired whenever the selected line changes or its
   * clue values are edited (used for the info banner / clue editor UI).
   * @param {Function} callback
   */
  function onSelectionChange(callback) {
    onSelectionChangeCallback = callback;
  }

  /**
   * Registers a callback fired whenever the set of globally active rules
   * changes, so the rule cards can reflect which ones are toggled on.
   * @param {Function} callback - receives (activeRuleIds: Set<string>, appliedCounts: Map<string, number>)
   */
  function onActiveRulesChange(callback) {
    onActiveRulesChangeCallback = callback;
  }

  /**
   * Sets (or clears) the hand-drawn mark of a single cell and refreshes
   * its visual immediately. Does not touch rule state or trigger a full
   * repaint — manual marks never affect what any rule computes, only
   * how the cell looks on top of (or underneath) it.
   * @param {number} row
   * @param {number} col
   * @param {"filled"|"cross"|null} value
   */
  function setManualMark(row, col, value) {
    if (!state.manualMarks[row] || state.manualMarks[row][col] === undefined) {
      return;
    }
    state.manualMarks[row][col] = value;
    renderManualMark(row, col);
  }

  /**
   * Applies the CSS classes for a cell's current manual mark. The
   * classes alone decide what's visible: `.is-manual-filled` sets a
   * solid background via CSS (a rule's inline `style.backgroundColor`
   * always wins over it, no extra logic needed), while
   * `.is-manual-cross` only renders its "×" when the cell does *not*
   * also carry `.is-rule-painted` (see the CSS) — that's what gives
   * rules priority over both kinds of manual marks.
   * @param {number} row
   * @param {number} col
   */
  function renderManualMark(row, col) {
    const cell = state.cellElements[row][col];
    if (!cell) {
      return;
    }
    const mark = state.manualMarks[row][col];
    cell.classList.toggle("is-manual-filled", mark === "filled");
    cell.classList.toggle("is-manual-cross", mark === "cross");
  }

  /**
   * Starts a manual-painting drag stroke from a mousedown on a cell.
   * Left button (0) draws/erases a solid "filled" mark; right button
   * (2) draws/erases a "cross" ("X") mark. Whichever mark the cell
   * already has decides whether this whole stroke paints or erases:
   * clicking a cell that already has that same mark clears it back to
   * empty, and dragging to further cells repeats that same action
   * (paint, or erase) rather than re-deciding per cell — so a drag
   * always does one consistent thing.
   * @param {MouseEvent} event
   */
  function handleCellMouseDown(event) {
    const cell = event.target.closest(".grid-cell");
    if (!cell || (event.button !== 0 && event.button !== 2)) {
      return;
    }
    event.preventDefault();

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const markType = event.button === 0 ? "filled" : "cross";
    const currentMark = state.manualMarks[row][col];

    manualDragValue = currentMark === markType ? null : markType;
    isManualDragging = true;
    lastDraggedCellKey = `${row},${col}`;

    setManualMark(row, col, manualDragValue);
  }

  /**
   * While a manual-painting drag is in progress, applies the stroke's
   * action to whichever new cell the cursor enters.
   * @param {MouseEvent} event
   */
  function handleCellMouseOver(event) {
    if (!isManualDragging) {
      return;
    }
    const cell = event.target.closest(".grid-cell");
    if (!cell) {
      return;
    }

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const key = `${row},${col}`;
    if (key === lastDraggedCellKey) {
      return;
    }
    lastDraggedCellKey = key;

    setManualMark(row, col, manualDragValue);
  }

  /** Ends the current manual-painting drag stroke, wherever the mouse is released. */
  function handleGlobalMouseUp() {
    isManualDragging = false;
    manualDragValue = null;
    lastDraggedCellKey = null;
  }

  /**
   * Wires up manual cell painting (left click = filled, right click =
   * cross, drag to repeat across cells) on the board's wrapper element,
   * using event delegation so it survives the board being rebuilt by
   * `generate()`/`loadScenario()`.
   * @param {HTMLElement} wrapperElement
   */
  function setupManualPainting(wrapperElement) {
    wrapperElement.addEventListener("mousedown", handleCellMouseDown);
    wrapperElement.addEventListener("mouseover", handleCellMouseOver);
    wrapperElement.addEventListener("contextmenu", (event) => {
      if (event.target.closest(".grid-cell")) {
        event.preventDefault();
      }
    });
    // Listened on the window, not just the wrapper, so releasing the
    // mouse button anywhere (even outside the board) ends the stroke.
    window.addEventListener("mouseup", handleGlobalMouseUp);
  }

  /**
   * Initializes the module with the wrapper element that will host the board.
   * @param {HTMLElement} wrapperElement
   */
  function init(wrapperElement) {
    gridWrapperElement = wrapperElement;
    setupManualPainting(wrapperElement);
  }

  app.Grid = {
    init,
    generate,
    toggleRule,
    clearColors,
    loadScenario,
    onSelectionChange,
    onActiveRulesChange,
    getSelectionSummary,
  };
})(window.NonogramApp);
