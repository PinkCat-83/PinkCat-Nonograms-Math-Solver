/**
 * Rule: Distribution with sum greater than half (per-block overlap).
 *
 * This is the multi-block sibling of "Norma mayor que la mitad", the
 * same way "Norma suma de bloques y espacios" is the multi-block
 * sibling of "Norma completa".
 *
 * Condition: p = total - (Σ(clues) + (numberOfBlocks - 1)), with p > 0
 * (p = 0 means every block is fully determined already, which is
 * exactly what "Norma suma de bloques y espacios" covers, so that case
 * is deliberately excluded here to avoid duplicating it).
 *
 * `p` is the *shared slack*: the number of extra empty cells beyond
 * what's strictly required (the blocks plus one mandatory gap between
 * each pair of consecutive blocks). That slack can sit anywhere —
 * before the first block, between any two blocks, or after the last
 * one — so every block can shift left or right by up to `p` cells as
 * a rigid group.
 *
 * For each block, comparing its leftmost possible position (all slack
 * pushed to the right) against its rightmost possible position (all
 * slack pushed to the left) gives the cells where both placements
 * agree — those are guaranteed to be part of the block regardless of
 * where the slack actually ends up, so they're safe to paint. A block
 * only has such cells if its own length is bigger than `p`; shorter
 * blocks contribute no safe cells (and are simply left unpainted) even
 * while other, longer blocks in the same line still get theirs.
 *
 * With a single block (numberOfBlocks = 1), this reduces exactly to
 * "Norma mayor que la mitad": the leftmost position starts at 0, so
 * the overlap is `[p, n - 1]`, the same range that rule computes with
 * `b = total - n` playing the role of `p`.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  const rule = {
    id: "blocks-distribution-greater-half",
    name: "rule_blocks_distribution_name",
    color: "#4f7a1c",
    condition: "p = total - (Σn + (k - 1)), p > 0",
    hint: "rule_blocks_distribution_hint",
    supportsMultipleClues: true,

    /**
     * Computes the shared slack `p` for the line.
     * @param {number[]} clueValues
     * @param {number} total
     * @returns {number}
     */
    computeSlack(clueValues, total) {
      const sumOfBlocks = clueValues.reduce((accumulator, value) => accumulator + value, 0);
      const mandatoryGaps = clueValues.length - 1;
      return total - (sumOfBlocks + mandatoryGaps);
    },

    /**
     * Computes the leftmost start position of every block, packing them
     * as far left as possible with exactly one mandatory gap cell
     * between consecutive blocks.
     * @param {number[]} clueValues
     * @returns {number[]} leftmost start index (0-indexed) per block
     */
    computeLeftmostStarts(clueValues) {
      const starts = [];
      let position = 0;

      clueValues.forEach((blockLength) => {
        starts.push(position);
        position += blockLength + 1; // block itself + mandatory gap after it
      });

      return starts;
    },

    /**
     * Only meaningful with 2+ blocks (see file header), only when there
     * is still some shared slack (`p > 0` — no slack means the line is
     * already fully determined, which is "Norma suma de bloques y
     * espacios"' territory), and only when at least one block is long
     * enough to have a guaranteed overlap.
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

      const p = this.computeSlack(clueValues, total);
      if (p <= 0) {
        return false;
      }

      return clueValues.some((blockLength) => blockLength > p);
    },

    /**
     * Paints, for every block long enough to have one, the cells where
     * its leftmost and rightmost possible placements agree.
     * @param {number[]} clueValues - all clue numbers for this line, in order
     * @param {number} total - number of cells in the line
     * @returns {boolean[]} mask of length `total`
     */
    computePaintMask(clueValues, total) {
      const mask = new Array(total).fill(false);
      const p = this.computeSlack(clueValues, total);
      const leftmostStarts = this.computeLeftmostStarts(clueValues);

      clueValues.forEach((blockLength, blockIndex) => {
        const leftmostStart = leftmostStarts[blockIndex];
        const overlapStart = leftmostStart + p;
        const overlapEnd = leftmostStart + blockLength - 1; // still 0-indexed, inclusive

        for (let cellIndex = overlapStart; cellIndex <= overlapEnd; cellIndex += 1) {
          mask[cellIndex] = true;
        }
      });

      return mask;
    },
  };

  app.registerRule(rule);
})(window.NonogramApp);
