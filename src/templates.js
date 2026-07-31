// ---------------------------------------------------------------------------
// RadAssist — CT Cardiac Calcium Score report boilerplate
// ---------------------------------------------------------------------------
// EDIT ME. Every fixed block of the report lives here so the wording can be
// updated without touching application logic. The TECHNIQUE and BACKGROUND
// paragraphs are DRAFT wording matching the phrasing captured from Dr. Ramos's
// "CT CARDIAC CALCIUM SCORE W/O CONTRAST" template; they are pending the
// client's exact verbatim text. Placeholders in {curly braces} are filled at
// generation time — leave them intact.
// ---------------------------------------------------------------------------

export const REPORT_TITLE = 'CT CARDIAC CALCIUM SCORE W/O CONTRAST';

// Draft pending client's exact template text.
export const TECHNIQUE_BOILERPLATE =
  'Non-contrast prospectively ECG-gated cardiac CT was performed on a 128-slice ' +
  'multidetector scanner from the level of the aortic arch through the inferior ' +
  'margin of the heart at 2.5 mm slice thickness. No intravenous contrast was ' +
  'administered. Coronary artery calcium was quantified using the Agatston ' +
  'method (AJ-130) with {SCORING_SOFTWARE} scoring software. Estimated radiation ' +
  'dose (DLP): {DLP} mGy-cm. Examination quality: {EXAM_QUALITY}.';

// Draft pending client's exact template text.
export const BACKGROUND_BOILERPLATE =
  'Coronary artery calcification is a marker of coronary atherosclerosis. The ' +
  'total (aggregate) Agatston calcium score reflects the overall burden of ' +
  'calcified coronary plaque and is an established predictor of future ' +
  'cardiovascular events. The score is compared against age-, gender-, and ' +
  'race/ethnicity-matched reference values from the Multi-Ethnic Study of ' +
  'Atherosclerosis (MESA) to derive the population percentile reported below.';

export const INDICATIONS_DEFAULT = 'Risk stratification.';
export const COMPARISON_DEFAULT = 'None.';

// Defaults for the fill-in fields inside TECHNIQUE (radiologist can edit in UI).
export const TECHNIQUE_FIELDS = {
  SCORING_SOFTWARE: 'TerraRecon',
  DLP: '___',
  EXAM_QUALITY: 'diagnostic',
};

// The two-line IMPRESSION formula. {TOTAL} and {PERCENTILE} are filled in.
export const IMPRESSION_LINE_1 =
  'The total (aggregate) calcium score using the AJ-130 method is {TOTAL}.';
export const IMPRESSION_LINE_2 =
  'The calcium score corresponds to percentile {PERCENTILE} for age, gender and ethnicity.';

// Impression line 2 when no MESA percentile can be computed. {REASON} is filled
// with the specific explanation (e.g. age outside the MESA range).
export const IMPRESSION_LINE_2_UNAVAILABLE =
  'A MESA percentile is not reported: {REASON}';

// FINDINGS lines used instead of the per-vessel table whenever a complete
// per-vessel breakdown that reconciles with the total is not available.
// Two distinct provenance statements — the report must state truthfully how
// the TOTAL was obtained:
//   * OVERRIDE: the radiologist entered the total directly (total-override).
export const BREAKDOWN_UNAVAILABLE_OVERRIDE_LINE =
  'Per-vessel breakdown not provided; the total Agatston score was entered directly.';
//   * PARTIAL: no override was given; the total was derived from the vessel
//     scores that were supplied (one or more vessels left blank).
export const BREAKDOWN_UNAVAILABLE_PARTIAL_LINE =
  'A complete per-vessel breakdown was not available; the total Agatston score reflects the supplied vessel scores.';

export const CITATION =
  'McClelland RL, Chung H, Detrano R, Post W, Kronmal RA. Distribution of ' +
  'coronary artery calcium by race, gender, and age: results from the ' +
  'Multi-Ethnic Study of Atherosclerosis (MESA). Circulation. 2006;113(1):30-37. ' +
  'Reference values: https://mesa-nhlbi.org/researchers/tools/cac-score-reference-values';

// Per-vessel labels, in report order.
export const VESSELS = [
  { key: 'leftMain', label: 'LEFT MAIN' },
  { key: 'lad', label: 'LAD' },
  { key: 'lcx', label: 'LCX' },
  { key: 'rca', label: 'RCA' },
];
