// ---------------------------------------------------------------------------
// Report assembly — turns vessel scores + MESA result into the ready-to-paste
// "CT CARDIAC CALCIUM SCORE W/O CONTRAST" report. Pure, no DOM, no I/O.
// ---------------------------------------------------------------------------
import {
  REPORT_TITLE, TECHNIQUE_BOILERPLATE, BACKGROUND_BOILERPLATE,
  INDICATIONS_DEFAULT, COMPARISON_DEFAULT, TECHNIQUE_FIELDS,
  IMPRESSION_LINE_1, IMPRESSION_LINE_2, IMPRESSION_LINE_2_UNAVAILABLE,
  BREAKDOWN_UNAVAILABLE_OVERRIDE_LINE, BREAKDOWN_UNAVAILABLE_PARTIAL_LINE,
  CITATION, VESSELS,
} from './templates.js';

function fill(str, map) {
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in map ? String(map[k]) : m));
}

// Agatston scores are clinically whole numbers, but inputs may carry decimals;
// a floating-point representation error (0.1 + 0.2 !== 0.3) must never cause a
// genuinely reconciling breakdown to be dropped from the report. The tolerance
// is scaled to the magnitude of the operands (a small multiple of
// Number.EPSILON) so it absorbs only IEEE-754 representation error — a real
// discrepancy, however tiny (e.g. 25 vs 25.0000005), must NOT reconcile.
function withinFloatTolerance(sum, total) {
  // Finite vessel scores can still overflow to Infinity when summed; a
  // non-finite operand makes the comparison degenerate (Infinity <= Infinity),
  // so it must never reconcile.
  if (!Number.isFinite(sum) || !Number.isFinite(total)) return false;
  return Math.abs(sum - total)
    <= 8 * Number.EPSILON * Math.max(1, Math.abs(sum), Math.abs(total));
}

// vessels: { leftMain, lad, lcx, rca } numbers (may be undefined/NaN).
// total: aggregate Agatston score.
// totalOverridden: true when the total was entered directly by the user
//   (total-override), false/absent when it was derived from the vessel scores.
// mesa: result object from computeMesa (or null when not computable).
// opts: { comparison, indications, other, techniqueFields }
export function buildReport({ vessels, total, totalOverridden = false, mesa, opts = {} }) {
  const techFields = { ...TECHNIQUE_FIELDS, ...(opts.techniqueFields || {}) };
  const comparison = opts.comparison || COMPARISON_DEFAULT;
  const indications = opts.indications || INDICATIONS_DEFAULT;
  const other = (opts.other && opts.other.trim())
    ? opts.other.trim()
    : 'No significant non-cardiac findings.';

  // Only print the per-vessel table when every vessel score was supplied AND
  // the values reconcile with TOTAL. Otherwise (total-override mode, a blank
  // vessel, or an override that disagrees with the entered vessels) the
  // breakdown is omitted — a report must never claim vessel values (e.g. all
  // zeros) that contradict its own TOTAL.
  const vesselValues = VESSELS.map(({ key }) => (vessels ? vessels[key] : undefined));
  const breakdownComplete = vesselValues.every((v) => Number.isFinite(v));
  const breakdownReconciles = breakdownComplete
    && withinFloatTolerance(vesselValues.reduce((a, b) => a + b, 0), total);

  // When the breakdown is omitted, the substitute line must state truthfully
  // how the TOTAL was obtained: "entered directly" only when an override was
  // actually supplied; otherwise the total came from the supplied vessels.
  const findingsLines = breakdownReconciles
    ? [
      'Calcium scoring by the Agatston (AJ-130) method, per vessel:',
      ...VESSELS.map(({ key, label }) => `  ${label}: ${vessels[key]}`),
    ]
    : [totalOverridden ? BREAKDOWN_UNAVAILABLE_OVERRIDE_LINE : BREAKDOWN_UNAVAILABLE_PARTIAL_LINE];

  const impression = ['1. ' + fill(IMPRESSION_LINE_1, { TOTAL: total })];
  if (mesa && mesa.ok) {
    impression.push('2. ' + fill(IMPRESSION_LINE_2, { PERCENTILE: mesa.percentile }));
  } else {
    // No dangling "[see note]" — the impression itself carries the reason.
    const reason = (mesa && mesa.warnings && mesa.warnings.length)
      ? mesa.warnings.join(' ')
      : 'MESA reference data is unavailable for the provided demographics.';
    impression.push('2. ' + fill(IMPRESSION_LINE_2_UNAVAILABLE, { REASON: reason }));
  }

  const sections = [
    `PROCEDURE: ${REPORT_TITLE}`,
    '',
    `COMPARISON: ${comparison}`,
    '',
    `INDICATIONS: ${indications}`,
    '',
    'TECHNIQUE:',
    fill(TECHNIQUE_BOILERPLATE, techFields),
    '',
    'BACKGROUND:',
    BACKGROUND_BOILERPLATE,
    '',
    'FINDINGS:',
    ...findingsLines,
    `  TOTAL (aggregate): ${total}`,
    '',
    `OTHER: ${other}`,
    '',
    'IMPRESSION:',
    ...impression,
    '',
    'REFERENCE:',
    CITATION,
  ];

  return sections.join('\n');
}
