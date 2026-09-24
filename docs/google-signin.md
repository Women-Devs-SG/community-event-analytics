# Private dashboard with Google sign-in

In `google-signin` mode, the dashboard is visible only to people the reporting sheet is shared with. Viewers sign in with their Google account and see live data. Nothing is published with the site: it contains only code.

```text
Viewer ──▶ "Sign in with Google" ──▶ ID token (a JWT that names the viewer)
       ──▶ Apps Script web app, attached to the sheet
             checks the token is genuine and for this dashboard
             checks the viewer is on the sheet's sharing list
       ──▶ sheet rows ──▶ dashboard, built in the viewer's browser
```

**Access list = the sheet's sharing.** Share the sheet with someone to let them in; remove them to revoke access. Viewers can read the sheet itself, so only share it with people who may see raw responses. The dashboard still applies `privacy.minimumSegmentSize` to keep charts readable, but in this mode it is not a privacy control.

For a dashboard that anyone can open, use the default public mode instead (see the [README](../README.md)).

## What you need

- The reporting Google Sheet, with the five tabs described in the [data contract](data-contract-v1.md).
- A Google account that owns the sheet.
- The dashboard's address, for example `https://<account>.github.io/<repository>/`.

No service account, no billing account, and no server are needed.

## 1. Create the OAuth client (Google Cloud)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (or reuse one).
2. Go to **APIs & Services → OAuth consent screen** (shown as **Google Auth Platform** in newer consoles):
   - User type: **External** (for regular Gmail accounts). Choose **Internal** only if everyone uses one Google Workspace.
   - Fill in the app name, a support email, and the developer contact email.
   - Scopes: add nothing. Sign-in needs only the basic `openid`, `email`, and `profile` scopes.
   - When the form is complete, **publish** the app (move it from *Testing* to *In production*). With only the basic scopes, Google does not normally require a review. Check the console for any notice, as Google's requirements change.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** the dashboard's origin without a path, e.g. `https://<account>.github.io`. Add `http://localhost:5173` for local development.
   - No redirect URIs are needed.
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). It is not a secret.

## 2. Add the Apps Script to the sheet

1. Open the sheet and choose **Extensions → Apps Script**.
2. Replace the editor's contents with [`apps-script/Code.gs`](../apps-script/Code.gs) from this repository.
3. At the top of the script, set `CLIENT_ID` to the client ID from step 1, and adjust `TABS` if your tab names differ.
4. Click **Deploy → New deployment**, choose type **Web app**, and set:
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Click **Deploy**, approve the permissions it asks for (it reads this spreadsheet and calls Google's token check), and copy the **Web app URL**. It ends in `/exec`.

"Anyone" means anyone may *call* the URL. The script answers only requests that carry a valid sign-in from someone on the sharing list.

After editing the script later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

## 3. Share the sheet

Share the sheet (Viewer is enough) with each person who should see the dashboard. Share with individual Google accounts: link sharing ("anyone with the link") and Google Groups are not checked by the script.

## 4. Configure the dashboard

Locally, in `.env.local`:

```dotenv
VITE_DATA_SOURCE=google-signin
VITE_SOURCE_LABEL=Community reporting sheet
VITE_GOOGLE_OAUTH_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfy.../exec
VITE_REPORTING_TIMEZONE=Asia/Singapore
```

For GitHub Pages, set the same names under **Settings → Secrets and variables → Actions → Variables**. Both values end up in the site's code, which is expected: neither grants access on its own.

Run `npm run dev`, sign in, and check both dashboard tabs.

## How it behaves

- **Live data:** every page load reads the sheet. No rebuild is needed after editing the sheet.
- **Sign-in lasts about an hour.** After that, reloading the page signs a returning viewer back in, usually automatically.
- **The sign-in token is kept in memory only.** Signing out, or closing the tab, discards it and the loaded data.
- **No access:** a viewer who isn't on the sharing list sees a message naming their account and can switch accounts.
- **Nothing is published at build time.** The build deletes any `public/dashboard-summary.json` left from another mode.

## Troubleshooting

| Message | Cause |
| --- | --- |
| "…doesn't have access" | The account isn't on the sheet's sharing list, or was shared through a link or group. |
| "Your sign-in expired or could not be verified" | Sign in again. If it keeps happening, check that `CLIENT_ID` in the script matches `VITE_GOOGLE_OAUTH_CLIENT_ID`. |
| "…unexpected response. Check that VITE_APPS_SCRIPT_URL…" | The URL is wrong, isn't the `/exec` URL, or the deployment isn't set to "Anyone". |
| "The sheet has no tab named…" | Update `TABS` in the script, then deploy a new version. |
| The Google button shows an error | The dashboard's origin is missing from **Authorized JavaScript origins**. |

The Apps Script's **Executions** page lists every request and any server errors.
