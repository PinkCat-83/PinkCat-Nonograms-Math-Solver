/**
 * Rule: Block greater than half.
 *
 * Condition: n > total / 2  AND  n < total
 * Calculation: b = total - n
 * The first `b` cells and the last `b` cells are left unpainted
 * (uncertain). Every remaining cell in the middle is guaranteed
 * to belong to the block, so it is safe to paint.
 *
 * The strict "n < total" upper bound is what keeps this rule from
 * overlapping "Norma completa": when n equals total, b = 0 and this
 * rule would paint the exact same full line that rule 1 already
 * covers, so that case is deliberately excluded here.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const rule = {
    id: "block-greater-half",
    name: "rule_block_greater_half_name",
    color: "#1c6e73",
    condition: "total/2 < n < total",
    hint: "rule_block_greater_half_hint",

    /**
     * The overlap technique only applies when the block is strictly
     * bigger than half the line, and strictly smaller than the line
     * itself — n = total is "Bloque completo" territory, not this rule.
     * @param {number} n - clue value entered by the user
     * @param {number} total - number of cells in the selected line
     * @returns {boolean}
     */
    isApplicable(n, total) {
      return Number.isInteger(n) && n > total / 2 && n < total;
    },

    /**
     * Leaves the first `b` and last `b` cells unpainted, paints the rest.
     * @param {number} n - clue value entered by the user
     * @param {number} total - number of cells in the selected line
     * @returns {boolean[]} mask of length `total`
     */
    computePaintMask(n, total) {
      const b = total - n;
      const mask = new Array(total).fill(false);

      for (let index = b; index < total - b; index += 1) {
        mask[index] = true;
      }

      return mask;
    },
  };

  app.registerRule(rule);
})(window.NonogramApp);
