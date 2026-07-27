/**
 * Rule: Complete block.
 *
 * If the clue number (n) equals the total length of the line
 * (row or column), then every cell in that line must be painted.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const rule = {
    id: "block-complete",
    name: "rule_block_complete_name",
    color: "#c0392b",
    condition: "n = total",
    hint: "rule_block_complete_hint",

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
})(window.NonogramApp);
