// "Sign in with Google" for the google-signin mode, using Google Identity
// Services. It yields an ID token (a JWT naming the viewer), which the Apps
// Script backend verifies. The token is kept in memory only, never stored.

interface CredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
  prompt(): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let loading: Promise<GoogleAccountsId> | null = null;
let initializedFor: string | null = null;
let credentialHandler: (credential: string) => void = () => {};

function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google sign-in did not start.'));
    script.onerror = () => {
      loading = null;
      reject(
        new Error('Google sign-in could not be loaded. Check your connection or any content blocker, then reload.'),
      );
    };
    document.head.append(script);
  });
  return loading;
}

/** Renders the Google button into `container`. `onCredential` receives the ID token. */
export async function showSignInButton(
  clientId: string,
  container: HTMLElement,
  onCredential: (credential: string) => void,
) {
  if (!clientId) throw new Error('Sign-in is not configured: VITE_GOOGLE_OAUTH_CLIENT_ID is missing.');
  const id = await loadGoogleIdentity();
  credentialHandler = onCredential;
  if (initializedFor !== clientId) {
    // auto_select signs a returning viewer straight back in when their
    // one-hour sign-in has expired.
    id.initialize({
      client_id: clientId,
      callback: (response) => credentialHandler(response.credential),
      auto_select: true,
      cancel_on_tap_outside: false,
    });
    initializedFor = clientId;
    id.prompt();
  }
  container.replaceChildren();
  id.renderButton(container, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' });
}

export function signOutOfGoogle() {
  window.google?.accounts?.id.disableAutoSelect();
}

export interface SignedInUser {
  email: string;
  name: string;
}

// For display only. The token's signature is checked by the Apps Script,
// which is the only place a decision about access is made.
export function readIdToken(jwt: string): SignedInUser {
  try {
    const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')), (c) =>
      c.charCodeAt(0),
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { email?: string; name?: string };
    return { email: claims.email ?? '', name: claims.name ?? claims.email ?? '' };
  } catch {
    return { email: '', name: '' };
  }
}
