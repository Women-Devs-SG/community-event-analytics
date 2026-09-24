/**
 * Community Event Analytics: sign-in backend for the `google-signin` data mode.
 *
 * Paste this file into the reporting sheet (Extensions → Apps Script) and
 * deploy it as a web app: Execute as "Me", Who has access "Anyone".
 * Setup guide: docs/google-signin.md
 *
 * Every request must carry a Google ID token (a JWT from "Sign in with Google").
 * The script returns the sheet's rows only when the token is genuine, was issued
 * for this dashboard's OAuth client, and belongs to someone the sheet is shared
 * with. Sharing the sheet is therefore the only access list.
 */

// ── Configure these two values ────────────────────────────────────────────────
// The OAuth client ID of the dashboard (same value as VITE_GOOGLE_OAUTH_CLIENT_ID).
const CLIENT_ID = 'replace-with-your-client-id.apps.googleusercontent.com';

// Tab names in this spreadsheet for each canonical dataset.
const TABS = {
  events: 'events',
  surveyResponses: 'survey_responses',
  feedbackAnswers: 'feedback_answers',
  registrations: 'registrations',
  participants: 'participants',
};
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/** Rejects a request with a machine-readable code the dashboard can explain. */
class RequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (typeof body.idToken !== 'string' || !body.idToken) throw new RequestError('invalid_token', 'No sign-in token was sent.');

    const claims = checkClaims_(fetchTokenClaims_(body.idToken), CLIENT_ID, Math.floor(Date.now() / 1000));
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!isAllowed_(claims.email, sharedWith_(spreadsheet))) {
      throw new RequestError('not_authorized', `${claims.email} is not on this sheet's sharing list.`);
    }

    const datasets = {};
    for (const key of Object.keys(TABS)) {
      const sheet = spreadsheet.getSheetByName(TABS[key]);
      if (!sheet) throw new RequestError('missing_tab', `The sheet has no tab named "${TABS[key]}".`);
      datasets[key] = rowsFromValues_(sheet.getDataRange().getDisplayValues());
    }
    return json_({ ok: true, email: claims.email, datasets, fetchedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof RequestError) return json_({ ok: false, code: error.code, message: error.message });
    console.error(error);
    return json_({ ok: false, code: 'server_error', message: 'The sheet could not be read. See the Apps Script executions log.' });
  }
}

function doGet() {
  return json_({ ok: false, code: 'method_not_allowed', message: 'This endpoint only answers the dashboard.' });
}

// Google's tokeninfo endpoint checks the JWT signature and expiry, and returns its claims.
function fetchTokenClaims_(idToken) {
  const response = UrlFetchApp.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new RequestError('invalid_token', 'The sign-in has expired or could not be verified.');
  return JSON.parse(response.getContentText());
}

// The claims must be for this dashboard, from Google, unexpired, and for a verified email.
function checkClaims_(claims, clientId, nowSeconds) {
  if (!claims || claims.aud !== clientId) throw new RequestError('invalid_token', 'The sign-in was issued for a different app.');
  if (TOKEN_ISSUERS.indexOf(claims.iss) === -1) throw new RequestError('invalid_token', 'The sign-in was not issued by Google.');
  if (!(Number(claims.exp) > nowSeconds)) throw new RequestError('invalid_token', 'The sign-in has expired.');
  if (String(claims.email_verified) !== 'true' || !claims.email) throw new RequestError('invalid_token', 'The Google account has no verified email address.');
  return { email: String(claims.email).toLowerCase() };
}

// Owner, editors, and viewers (including commenters) of the spreadsheet. Link
// sharing and Google Groups are not expanded: share with individual accounts.
function sharedWith_(spreadsheet) {
  const users = [spreadsheet.getOwner()].concat(spreadsheet.getEditors(), spreadsheet.getViewers());
  return users.filter(Boolean).map((user) => user.getEmail());
}

function isAllowed_(email, sharedEmails) {
  const wanted = String(email).toLowerCase();
  return sharedEmails.some((shared) => String(shared).toLowerCase() === wanted);
}

// First row is the header; fully blank rows are skipped.
function rowsFromValues_(values) {
  const header = (values[0] || []).map((field) => String(field).trim());
  return values.slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ''))
    .map((row) => {
      const record = {};
      header.forEach((field, index) => {
        if (field) record[field] = row[index] === undefined ? '' : row[index];
      });
      return record;
    });
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
