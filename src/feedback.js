// Feedback text builder — pure, DOM-free, testable.
//
// PHI SAFETY CONTRACT: the feedback body is built ONLY from the whitelisted
// free-text fields below plus an optional name. Nothing from the report,
// vessel scores, demographics, or any other app state may enter this text —
// a generated report can contain patient data and must never leave via
// feedback. Extra properties on the input object are ignored by design.

export const FEEDBACK_EMAIL = 'rfinlay813@gmail.com';
export const FEEDBACK_SUBJECT = 'RadAssist Pilot Feedback';

// Static build label: the app is a no-build static page, so there is no git
// sha available at runtime. Per spec, 'pilot' is the accepted fallback.
export const APP_BUILD = 'pilot';

// Whitelist of feedback prompts. Keys map to form fields; labels appear in
// both the UI and the assembled text block.
export const FEEDBACK_FIELDS = [
  { key: 'worked', label: 'What worked well?' },
  { key: 'wrong', label: 'What was wrong or off in the report?' },
  { key: 'missing', label: "What's missing / what would save you the most time?" },
  { key: 'priority', label: 'Overall priority for the next build' },
];

function clean(v) {
  return String(v ?? '').trim();
}

export function buildFeedbackText(input = {}) {
  const lines = ['RadAssist Pilot Feedback', ''];
  for (const { key, label } of FEEDBACK_FIELDS) {
    const val = clean(input[key]);
    lines.push(label, val === '' ? '(no response)' : val, '');
  }
  const name = clean(input.name);
  lines.push(`From: ${name === '' ? '(not given)' : name}`);
  lines.push(`App build: ${APP_BUILD}`);
  return lines.join('\n');
}

export function buildMailtoHref(text) {
  return `mailto:${FEEDBACK_EMAIL}` +
    `?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}` +
    `&body=${encodeURIComponent(text)}`;
}

export const FEEDBACK_FILENAME = 'radassist-feedback.txt';

// Download (.txt) is the guaranteed export path. Email is size-bounded and
// clipboard is permission-dependent, but writing a Blob to a file cannot
// fail, so this is the escape hatch when both primary paths are unavailable.
// PHI SAFETY: the payload is exactly the assembled feedback text passed in —
// built from the same whitelist as the mailto body — and nothing else.
export function buildFeedbackDownload(text) {
  return {
    filename: FEEDBACK_FILENAME,
    mime: 'text/plain',
    body: String(text ?? ''),
  };
}

// Mail clients / OS protocol handlers silently truncate or reject long
// mailto: URLs (commonly around 2KB). Beyond this budget the email path must
// degrade to copy-and-paste rather than navigate to a broken link.
export const MAILTO_MAX_BYTES = 1800;

// The href is pure ASCII (the mailto:/address/param prefix is ASCII and
// encodeURIComponent emits only ASCII), so string length equals byte length.
export function buildMailto(text) {
  const href = buildMailtoHref(text);
  return { href, bytes: href.length, ok: href.length <= MAILTO_MAX_BYTES };
}
