/**
 * Clue editor module.
 *
 * A small modal popup used to type the clue numbers for one row or
 * column. Shows the sum of the numbers typed so far against the total
 * length of the line, so the person can see immediately whether it
 * still fits.
 */
window.CronogramApp = window.CronogramApp || {};

(function (app) {
  "use strict";

  let overlayElement = null;
  let popupElement = null;
  let titleElement = null;
  let inputElement = null;
  let sumInfoElement = null;
  let confirmButton = null;

  let activeOnConfirm = null;
  let activeTotal = 0;

  /** Builds the popup DOM once and reuses it for every call to open(). */
  function ensureBuilt() {
    if (overlayElement) {
      return;
    }

    overlayElement = document.createElement("div");
    overlayElement.className = "clue-popup-overlay";

    popupElement = document.createElement("div");
    popupElement.className = "clue-popup";
    popupElement.setAttribute("role", "dialog");
    popupElement.setAttribute("aria-modal", "true");

    titleElement = document.createElement("h3");
    titleElement.className = "clue-popup__title";

    const label = document.createElement("label");
    label.className = "clue-popup__label";
    label.textContent = "Pistas (separadas por espacio)";

    inputElement = document.createElement("input");
    inputElement.type = "text";
    inputElement.inputMode = "numeric";
    inputElement.autocomplete = "off";
    inputElement.className = "clue-popup__input";
    inputElement.placeholder = "ej. 1 5 6";
    label.appendChild(inputElement);

    sumInfoElement = document.createElement("p");
    sumInfoElement.className = "clue-popup__sum";

    const actions = document.createElement("div");
    actions.className = "clue-popup__actions";

    confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "btn btn--primary";
    confirmButton.textContent = "Aceptar";

    actions.appendChild(confirmButton);

    popupElement.appendChild(titleElement);
    popupElement.appendChild(label);
    popupElement.appendChild(sumInfoElement);
    popupElement.appendChild(actions);
    overlayElement.appendChild(popupElement);
    document.body.appendChild(overlayElement);

    inputElement.addEventListener("input", updateSumInfo);
    confirmButton.addEventListener("click", confirmAndClose);

    // Clicking the dimmed backdrop or pressing Escape closes the popup
    // without saving changes (there is no separate "Cancelar" button).
    overlayElement.addEventListener("click", (event) => {
      if (event.target === overlayElement) {
        close();
      }
    });

    overlayElement.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Enter" && document.activeElement === inputElement) {
        event.preventDefault();
        confirmAndClose();
      }
    });
  }

  /**
   * Parses a raw string like "1 5 6" into an array of valid clue numbers.
   * @param {string} text
   * @returns {number[]}
   */
  function parseValues(text) {
    return text
      .split(/\s+/)
      .map((token) => parseInt(token, 10))
      .filter((value) => Number.isInteger(value) && value >= 0);
  }

  /** Updates the live sum-vs-total line inside the popup. */
  function updateSumInfo() {
    const values = parseValues(inputElement.value);
    const sum = values.reduce((accumulator, value) => accumulator + value, 0);
    const isValid = sum <= activeTotal;

    sumInfoElement.textContent = `Suma introducida: ${sum} · Longitud de la línea: ${activeTotal}`;
    sumInfoElement.classList.toggle("is-invalid", !isValid);
  }

  /** Confirms the current input, notifies the caller and closes the popup. */
  function confirmAndClose() {
    const values = parseValues(inputElement.value);

    if (typeof activeOnConfirm === "function") {
      activeOnConfirm(values);
    }

    close();
  }

  /** Hides the popup without applying any changes. */
  function close() {
    if (overlayElement) {
      overlayElement.classList.remove("is-open");
    }
    activeOnConfirm = null;
  }

  /**
   * Opens the popup pre-filled with the current clue numbers of a line.
   * @param {Object} options
   * @param {string} options.title - popup heading, e.g. "Pistas de la Fila 3"
   * @param {number[]} options.initialValues - clues already set for this line
   * @param {number} options.total - length of the line (target sum)
   * @param {function(number[]): void} options.onConfirm - called with the parsed values on accept
   */
  function open(options) {
    ensureBuilt();

    titleElement.textContent = options.title;
    activeTotal = options.total;
    activeOnConfirm = options.onConfirm;
    inputElement.value = options.initialValues.join(" ");

    overlayElement.classList.add("is-open");
    updateSumInfo();

    window.requestAnimationFrame(() => {
      inputElement.focus();
      inputElement.select();
    });
  }

  app.ClueEditor = { open };
})(window.CronogramApp);
