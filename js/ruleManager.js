/**
 * Global namespace for the whole application.
 * Every module attaches itself to this single object so that
 * plain <script> tags can share state without a bundler.
 */
window.NonogramApp = window.NonogramApp || {};

(function (app) {
  "use strict";

  /**
   * Registry of all available rules.
   * Each rule module (js/rules/*.js) pushes one rule object here.
   *
   * A rule object must implement:
   *   - id: string, unique identifier
   *   - name: string, a translation KEY (e.g. "rule_block_complete_name"),
   *       resolved to display text via `app.i18n.t()` — the actual text
   *       lives in language/translations.csv, not here.
   *   - color: string, CSS color used to paint matching cells
   *   - hint: string, a translation KEY (same convention as `name`)
   *   - isApplicable(n, total): boolean, whether the rule can be used
   *   - computePaintMask(n, total): boolean[] of length `total`,
   *       true at positions that must be painted
   *
   * Optional field:
   *   - supportsMultipleClues: boolean (default false/absent). If true,
   *       the line's *entire* clue array is passed instead of a single
   *       number, for both functions above:
   *         isApplicable(clueValues, total): boolean
   *         computePaintMask(clueValues, total): boolean[] of length `total`
   *       This is for rules that reason about several blocks in the
   *       same line at once (e.g. "several clues + mandatory gaps fill
   *       the line exactly"), as opposed to rules that only ever look
   *       at lines with a single clue number.
   *
   * `condition` (the math formula, e.g. "n = total") is NOT translated
   * — it only ever uses variable names (n, total, k, p, Σ), which read
   * the same in every supported language, so it isn't in the CSV at
   * all and stays a plain literal string here.
   */
  app.rules = app.rules || [];

  /**
   * Registers a rule so it becomes available in the UI.
   * @param {Object} rule
   */
  app.registerRule = function registerRule(rule) {
    const hasRequiredFields =
      rule &&
      typeof rule.id === "string" &&
      typeof rule.name === "string" &&
      typeof rule.color === "string" &&
      typeof rule.isApplicable === "function" &&
      typeof rule.computePaintMask === "function";

    if (!hasRequiredFields) {
      console.error("Invalid rule definition, skipped:", rule);
      return;
    }

    app.rules.push(rule);
  };
})(window.NonogramApp);
