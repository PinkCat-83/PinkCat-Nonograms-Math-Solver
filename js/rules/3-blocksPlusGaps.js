/**
 * Rule: Sum of blocks plus mandatory gaps equals the total.
 *
 * Condition: Σ(clues) + (numberOfBlocks - 1) = total
 *
 * This is the multi-block sibling of "Norma completa": when a line has
 * several clue numbers (e.g. "3 4"), there must be at least one empty
 * cell between consecutive blocks. If the sum of the blocks plus those
 * mandatory single-cell gaps exactly fills the line, there is no slack
 * left to shift anything — every block's position is fully determined,
 * so it is safe to paint.
 *
 * Only lines with 2 or more clues are considered. With a single clue,
 * the formula collapses to `n + 0 = total`, i.e. `n = total`, which is
 * exactly "Norma completa" — that case is deliberately excluded here so
 * the two rules never overlap, the same way "Norma mayor que la mitad"
 * excludes `n = total` to avoid duplicating "Norma completa".
 */
window.CronogramApp = window.CronogramApp || {};

(function (app) {
  "use strict";

  const rule = {
    id: "blocks-plus-gaps-equal-total",
    name: "Norma suma de bloques y espacios",
    color: "#94316f",
    condition: "Σn + (k - 1) = total",
    hint:
      "Si la suma de todos los bloques de la línea más los huecos obligatorios entre ellos " +
      "(uno menos que el número de bloques) es igual al total, cada bloque tiene una única " +
      "posición posible y se pinta.",
    supportsMultipleClues: true,

    /**
     * Only meaningful with 2+ blocks (see file header for why a single
     * block is excluded), and only when there is no leftover slack to
     * shift the blocks around.
     * @param {number[]} clueValues - all clue numbers for this line, in order
     * @param {number} total - number of cells in the line
     * @returns {boolean}
     */
    isApplicable(clueValues, total) {
      if (!Array.isArray(clueValues) || clueValues.length < 2) {
        return false;
      }
      if (!clueValues.every((value) => Number.isInteger(value) && value > 0)) {
        return false;
      }

      const sumOfBlocks = clueValues.reduce((accumulator, value) => accumulator + value, 0);
      const mandatoryGaps = clueValues.length - 1;

      return sumOfBlocks + mandatoryGaps === total;
    },

    /**
     * Lays out each block right after the previous one plus exactly one
     * mandatory unpainted gap cell, since there is no slack left to
     * place them any other way.
     * @param {number[]} clueValues - all clue numbers for this line, in order
     * @param {number} total - number of cells in the line
     * @returns {boolean[]} mask of length `total`
     */
    computePaintMask(clueValues, total) {
      const mask = new Array(total).fill(false);
      let position = 0;

      clueValues.forEach((blockLength, blockIndex) => {
        for (let offset = 0; offset < blockLength; offset += 1) {
          mask[position + offset] = true;
        }
        position += blockLength;

        const isLastBlock = blockIndex === clueValues.length - 1;
        if (!isLastBlock) {
          position += 1; // mandatory gap cell, left unpainted
        }
      });

      return mask;
    },
  };

  app.registerRule(rule);
})(window.CronogramApp);
