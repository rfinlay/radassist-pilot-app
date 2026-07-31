// ---------------------------------------------------------------------------
// MESA Coronary Artery Calcium (CAC) percentile model — FULLY LOCAL.
//
// Model: McClelland RL et al., "Distribution of coronary artery calcium by
// race, gender, and age," Circulation 2006;113(1):30-37 — the model behind the
// official MESA "CAC Score Reference Values" tool (mesa-nhlbi.org).
//
// Two-part (zero-inflated log-normal) form, per gender x race/ethnicity group:
//   * probability of non-zero CAC:  logit(p) = c0 + c1*age + c2*age^2
//   * amount of CAC given CAC > 0:   ln(Agatston) ~ Normal(mu, sigma),
//                                    mu = b0 + b1*age,  sigma constant per group
//
// Percentile of an observed positive score S (percentage of the reference
// population at or below S):
//   percentile = 100 * [ (1 - p) + p * Phi( (ln S - mu) / sigma ) ]
//
// The COEF table below was calibrated to reproduce the official MESA tool's
// own percentile / probability outputs across a dense synthetic grid of
// age x gender x race x score (no patient data involved). Validated against
// the two published reference points and hundreds of tool outputs — see
// test/mesa.test.js and README.md. This file makes NO network calls.
// ---------------------------------------------------------------------------

export const AGE_MIN = 45;
export const AGE_MAX = 84;
export const GENDERS = ['male', 'female'];
export const ETHNICITIES = ['white', 'black', 'hispanic', 'chinese'];

// Calibrated coefficients (see README "MESA model derivation"). Per group:
//   mu:    [b0, b1]  ->  mu(age) = b0 + b1*age  (mean of ln Agatston | CAC>0),
//                        least-squares calibrated to the MESA tool's percentiles.
//   sigma: SD of ln Agatston among CAC>0 (constant per group).
//   prob:  probability (%) of non-zero CAC at each age in PROB_AGE_KNOTS,
//          read directly from the MESA tool; interpolated piecewise-linearly.
const PROB_AGE_KNOTS = [45, 50, 55, 60, 65, 70, 75, 80, 84];
const COEF = {
  male_white:     { mu: [0.153612, 0.072702], sigma: 1.713372, prob: [25, 41, 56, 68, 77, 83, 90, 96, 99] },
  male_black:     { mu: [0.711416, 0.056457], sigma: 1.761864, prob: [19, 28, 37, 46, 56, 66, 75, 84, 92] },
  male_hispanic:  { mu: [2.088603, 0.037324], sigma: 1.694240, prob: [23, 31, 38, 51, 64, 75, 84, 92, 99] },
  male_chinese:   { mu: [2.183177, 0.032389], sigma: 1.699974, prob: [28, 36, 45, 54, 64, 71, 77, 82, 86] },
  female_white:   { mu: [1.297325, 0.043854], sigma: 1.814196, prob: [7, 16, 26, 36, 47, 59, 73, 87, 98] },
  female_black:   { mu: [2.197295, 0.029107], sigma: 1.832686, prob: [8, 15, 21, 28, 37, 49, 62, 74, 85] },
  female_hispanic:{ mu: [2.686838, 0.021101], sigma: 1.815742, prob: [4, 11, 19, 27, 38, 50, 62, 74, 83] },
  female_chinese: { mu: [3.238874, 0.011694], sigma: 1.788064, prob: [4, 16, 27, 37, 46, 55, 64, 74, 81] },
};

// Piecewise-linear interpolation of the tabulated non-zero probability (%).
function interpProb(probPct, age) {
  const ks = PROB_AGE_KNOTS;
  if (age <= ks[0]) return probPct[0] / 100;
  if (age >= ks[ks.length - 1]) return probPct[probPct.length - 1] / 100;
  for (let i = 1; i < ks.length; i++) {
    if (age <= ks[i]) {
      const t = (age - ks[i - 1]) / (ks[i] - ks[i - 1]);
      return (probPct[i - 1] + t * (probPct[i] - probPct[i - 1])) / 100;
    }
  }
  return probPct[probPct.length - 1] / 100;
}

// Standard normal CDF via erf (Abramowitz & Stegun 7.1.26).
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}
function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function groupKey(gender, ethnicity) {
  return `${gender}_${ethnicity}`;
}

// Probability (0..1) of a non-zero CAC score for this demographic.
export function probNonZero(gender, ethnicity, age) {
  const c = COEF[groupKey(gender, ethnicity)];
  if (!c) throw new Error(`Unknown group: ${gender}/${ethnicity}`);
  return interpProb(c.prob, age);
}

// Core computation. Returns a result object; never throws on user input
// values, but reports validity via `ok` + `warnings`.
//   total: aggregate Agatston score (>= 0)
export function computeMesa(gender, ethnicity, age, total) {
  const warnings = [];
  const g = String(gender).toLowerCase();
  const e = String(ethnicity).toLowerCase();

  if (!GENDERS.includes(g)) {
    return { ok: false, warnings: [`Invalid gender: ${gender}`] };
  }
  if (!ETHNICITIES.includes(e)) {
    return { ok: false, warnings: [`Invalid race/ethnicity: ${ethnicity}`] };
  }
  if (!Number.isFinite(age)) {
    return { ok: false, warnings: ['Age is required for the MESA percentile.'] };
  }
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, warnings: ['A valid total Agatston score (>= 0) is required.'] };
  }
  if (age < AGE_MIN || age > AGE_MAX) {
    return {
      ok: false,
      outOfRange: true,
      warnings: [
        `Age ${age} is outside the MESA-validated range (${AGE_MIN}-${AGE_MAX}). ` +
        'A percentile cannot be reported for this age.',
      ],
    };
  }

  const c = COEF[groupKey(g, e)];
  const p = probNonZero(g, e, age);

  let percentile;
  if (total <= 0) {
    // A zero score sits within the point mass at zero. The MESA tool reports
    // percentile 0 for an observed score of 0.
    percentile = 0;
  } else {
    const mu = c.mu[0] + c.mu[1] * age;
    const F = normalCdf((Math.log(total) - mu) / c.sigma);
    percentile = Math.round(((1 - p) + p * F) * 100);
    if (percentile < 0) percentile = 0;
    if (percentile > 99) percentile = 99;
  }

  return {
    ok: true,
    percentile,
    probNonZero: p,
    probNonZeroPct: Math.round(p * 100),
    gender: g,
    ethnicity: e,
    age,
    total,
    warnings,
  };
}
