// UI wiring. Reads inputs, runs the local MESA model, renders the report.
import { computeMesa, AGE_MIN, AGE_MAX } from './mesa.js';
import { buildReport } from './report.js';
import { VESSELS } from './templates.js';
import { buildFeedbackText, buildMailto, buildFeedbackDownload } from './feedback.js';

const $ = (id) => document.getElementById(id);

function numOrNull(el) {
  const raw = el.value.trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN; // NaN signals "present but invalid"
}

function readVessels() {
  const out = {};
  for (const { key } of VESSELS) {
    const n = numOrNull($(key));
    out[key] = n; // null | NaN | number
  }
  return out;
}

function sumVessels(vessels) {
  let sum = 0;
  for (const { key } of VESSELS) {
    const v = vessels[key];
    if (Number.isFinite(v) && v > 0) sum += v;
  }
  return sum;
}

function setMsg(el, text, kind) {
  if (!text) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="msg ${kind}">${text}</div>`;
}

function validate(vessels, totalOverride, age) {
  const errors = [];
  for (const { key, label } of VESSELS) {
    const v = vessels[key];
    if (Number.isNaN(v)) errors.push(`${label} is not a valid number.`);
    else if (Number.isFinite(v) && v < 0) errors.push(`${label} cannot be negative.`);
  }
  if (Number.isNaN(totalOverride)) errors.push('Total override is not a valid number.');
  else if (Number.isFinite(totalOverride) && totalOverride < 0) errors.push('Total override cannot be negative.');
  if (age === null) errors.push('Age is required.');
  else if (Number.isNaN(age)) errors.push('Age is not a valid number.');
  return errors;
}

function render() {
  const vessels = readVessels();
  const totalOverride = numOrNull($('totalOverride'));
  const age = numOrNull($('age'));
  const gender = $('gender').value;
  const ethnicity = $('ethnicity').value;

  const formMsg = $('form-msg');
  const errors = validate(vessels, totalOverride, age);

  // mark invalid fields
  for (const { key } of VESSELS) {
    $(key).setAttribute('aria-invalid', Number.isNaN(vessels[key]) ? 'true' : 'false');
  }
  $('age').setAttribute('aria-invalid', Number.isNaN(age) ? 'true' : 'false');

  if (errors.length) {
    setMsg(formMsg, errors.join('<br />'), 'error');
    // Never leave a previously generated (now stale) report visible/copyable
    // next to a validation error.
    $('report-text').textContent = '';
    $('copy-status').textContent = '';
    $('results').hidden = true;
    $('placeholder').hidden = false;
    return;
  }
  setMsg(formMsg, '', '');

  const total = Number.isFinite(totalOverride)
    ? totalOverride
    : sumVessels(vessels);

  const mesa = computeMesa(gender, ethnicity, age, total);

  // Stats
  $('stat-total').textContent = String(total);
  $('stat-pct').textContent = mesa.ok ? String(mesa.percentile) : '—';
  $('stat-prob').textContent = mesa.ok ? `${mesa.probNonZeroPct}%` : '—';

  // Result-level messaging (age out of range etc.)
  const resultMsg = $('result-msg');
  if (!mesa.ok) {
    const kind = mesa.outOfRange ? 'warn' : 'error';
    setMsg(resultMsg, mesa.warnings.join('<br />') +
      (mesa.outOfRange ? '<br />The report is still generated; its impression states that a MESA percentile is not reported for this age.' : ''),
      kind);
  } else if (total === 0) {
    setMsg(resultMsg, 'Total score is 0 (no detectable coronary calcium) — percentile 0.', 'warn');
  } else {
    setMsg(resultMsg, '', '');
  }

  // Report text
  const report = buildReport({
    vessels,
    total,
    totalOverridden: Number.isFinite(totalOverride),
    mesa,
    opts: { other: $('other').value },
  });
  // textContent (not .value): the textarea is readonly so its displayed value
  // tracks the default value, and this way the report survives DOM
  // serialization (headless-render verification).
  $('report-text').textContent = report;

  $('placeholder').hidden = true;
  $('results').hidden = false;
  $('copy-status').textContent = '';
}

async function copyReport() {
  const text = $('report-text').value;
  const status = $('copy-status');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      $('report-text').focus();
      $('report-text').select();
      if (!document.execCommand('copy')) {
        throw new Error('execCommand copy reported failure');
      }
    }
    status.textContent = 'Copied ✓';
  } catch {
    // Fallback: select so the user can Cmd/Ctrl+C manually.
    $('report-text').focus();
    $('report-text').select();
    status.textContent = 'Press Cmd/Ctrl+C to copy';
  }
  setTimeout(() => { status.textContent = ''; }, 2500);
}

// Optional prefill from URL query params (bookmarkable inputs; no PHI).
// e.g. ?leftMain=0&lad=10&lcx=5&rca=10&age=65&gender=male&ethnicity=hispanic&go=1
function prefillFromUrl() {
  const q = new URLSearchParams(location.search);
  if ([...q.keys()].length === 0) return;
  for (const id of ['leftMain', 'lad', 'lcx', 'rca', 'totalOverride', 'age', 'other']) {
    if (q.has(id)) $(id).value = q.get(id);
  }
  for (const id of ['gender', 'ethnicity']) {
    if (q.has(id)) $(id).value = q.get(id);
  }
  if (q.get('go')) render();
}

// --- Feedback panel ---
// PHI safety: reads ONLY the four free-text feedback fields + optional name.
// Never touches report text, vessel scores, or demographics.
function readFeedback() {
  return {
    worked: $('fb-worked').value,
    wrong: $('fb-wrong').value,
    missing: $('fb-missing').value,
    priority: $('fb-priority').value,
    name: $('fb-name').value,
  };
}

function setFbStatus(text) {
  const status = $('fb-status');
  status.textContent = text;
  setTimeout(() => { status.textContent = ''; }, 2500);
}

async function copyFeedback() {
  const text = buildFeedbackText(readFeedback());
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const scratch = document.createElement('textarea');
      scratch.value = text;
      document.body.appendChild(scratch);
      let ok;
      try {
        scratch.select();
        ok = document.execCommand('copy');
      } finally {
        // execCommand can throw; the scratch textarea (full of feedback text)
        // must never be left visible on the page.
        scratch.remove();
      }
      if (!ok) throw new Error('execCommand copy reported failure');
    }
    setFbStatus('Copied ✓');
  } catch {
    setFbStatus('Copy failed — use Download (.txt) instead');
  }
}

// Guaranteed export path: needs neither clipboard permission nor a working
// mailto handler, and has no size limit. Escape hatch when both fail.
function downloadFeedback() {
  const { filename, mime, body } =
    buildFeedbackDownload(buildFeedbackText(readFeedback()));
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    // Revoking synchronously races the download: the navigation consumes the
    // object URL asynchronously (Safari especially), so an immediate revoke
    // can yank the blob before the browser reads it. Defer long enough for
    // the download to start, then free the memory.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  setFbStatus('Download started — attach the .txt to an email to Rick');
}

$('calc-form').addEventListener('submit', (e) => { e.preventDefault(); render(); });
$('copy-btn').addEventListener('click', copyReport);
$('fb-copy').addEventListener('click', copyFeedback);
$('fb-download').addEventListener('click', downloadFeedback);
// Set the mailto href just-in-time: click listeners run before the browser
// reads the anchor's href for navigation, so the body always reflects the
// current field contents. Oversized bodies never navigate — mail clients
// silently truncate or reject long mailto: URLs, which would lose feedback.
$('fb-email').addEventListener('click', (e) => {
  const { href, ok } = buildMailto(buildFeedbackText(readFeedback()));
  if (!ok) {
    e.preventDefault();
    e.currentTarget.href = '#';
    setFbStatus('Too long to email — use Copy feedback or Download (.txt) instead.');
    return;
  }
  e.currentTarget.href = href;
});
prefillFromUrl();

// Expose for headless-render / automated verification.
window.__radassist = { computeMesa, buildReport, render };
