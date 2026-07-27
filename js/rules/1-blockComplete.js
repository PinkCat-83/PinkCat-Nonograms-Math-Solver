/**
 * Rule: Complete block.
 *
 * If the clue number (n) equals the total length of the line
 * (row or column), then every cell in that line must be painted.
 */
window.CronogramApp = window.CronogramApp || {};

(function (app) {
  "use strict";

  const rule = {
    id: "block-complete",
    name: "Norma completa",
    color: "#c0392b",
    condition: "n = total",
    hint: "Si n = total de la fila/columna, se pinta toda la línea.",

    /**
     * The rule only makes sense when the clue fills the whole line.
     * @param {number} n - clue value entered by the user
     * @param {number} total - number of cells in the selected line
     * @returns {boolean}
     */
    isApplicable(n, total) {
      return Number.isInteger(n) && n === total;
    },

    /**
     * Every cell is safe to paint.
     * @param {number} n - clue value entered by the user
     * @param {number} total - number of cells in the selected line
     * @returns {boolean[]} mask of length `total`
     */
    computePaintMask(n, total) {
      return new Array(total).fill(true);
    },
  };

  app.registerRule(rule);
})(window.CronogramApp);
