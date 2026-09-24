import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { communityConfig as config } from './config';
import { formatLoadError, formatSignInError, loadSummary, onFilterChange, setFilters } from './data';
import { readIdToken, showSignInButton, signOutOfGoogle } from './auth/google-identity';
import type { SignedInUser } from './auth/google-identity';
import { buildFilterBar } from './components';
import { initEffectiveness } from './dash-effectiveness';
import { initCommunity } from './dash-community';
import type { DashboardController } from './types';
import type { DashboardSummary } from './summary/types';

type DashboardTab = 'effectiveness' | 'community';

// google-signin: viewers sign in with Google and the data is read live from
// the sheet. Otherwise the prebuilt public summary is loaded.
const signInMode = config.data.sourceKind === 'google-signin';

function BrandLogo() {
  const initials = config.community.shortName.slice(0, 4).toUpperCase();
  return (
    <div className="brand" aria-label={config.community.name}>
      <span className="brand-mark" aria-hidden="true">{initials}</span>
      <span className="brand-copy">
        <strong>{config.community.name}</strong>
        {config.community.locationLabel && <small>{config.community.locationLabel}</small>}
      </span>
    </div>
  );
}

function App() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('effectiveness');
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const signInButtonRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const effectivenessRef = useRef<HTMLElement>(null);
  const communityRef = useRef<HTMLElement>(null);
  const controllersRef = useRef<Partial<Record<DashboardTab, DashboardController>>>({});

  useEffect(() => {
    document.title = `${config.community.name} · ${config.community.dashboardTitle}`;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--surface', config.branding.surface);
    rootStyle.setProperty('--card', config.branding.card);
    rootStyle.setProperty('--ink', config.branding.ink);
    rootStyle.setProperty('--brand-primary', config.branding.primary);
    rootStyle.setProperty('--brand-secondary', config.branding.secondary);
    rootStyle.setProperty('--brand-accent', config.branding.accent);
  }, []);

  useEffect(() => {
    if (signInMode) return;
    let cancelled = false;
    loadSummary()
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((reason: unknown) => {
        console.error(reason);
        if (!cancelled) setError(formatLoadError(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCredential = useCallback(async (credential: string) => {
    const signedIn = readIdToken(credential);
    setUser(signedIn);
    setError(null);
    setSigningIn(true);
    try {
      const { loadLiveSummary } = await import('./summary/live');
      setData(await loadLiveSummary(credential));
    } catch (reason: unknown) {
      console.error(reason);
      setError(formatSignInError(reason, signedIn.email));
    } finally {
      setSigningIn(false);
    }
  }, []);

  // Show the Google button whenever the sign-in card is on screen.
  useEffect(() => {
    if (!signInMode || data || signingIn || !signInButtonRef.current) return;
    showSignInButton(config.data.googleSignIn.clientId, signInButtonRef.current, onCredential).catch((reason: unknown) => {
      console.error(reason);
      setError(reason instanceof Error ? reason.message : 'Google sign-in could not be started.');
    });
  }, [data, signingIn, onCredential]);

  const signOut = () => {
    signOutOfGoogle();
    setData(null);
    setUser(null);
    setError(null);
  };

  useEffect(() => {
    if (!data || !filterBarRef.current || !effectivenessRef.current || !communityRef.current) return;

    const filterBar = filterBarRef.current;
    buildFilterBar(filterBar, data);
    const effectiveness: DashboardController = initEffectiveness(effectivenessRef.current, data);
    const community: DashboardController = initCommunity(communityRef.current, data);
    controllersRef.current = { effectiveness, community };
    effectiveness.update();
    community.update();

    const unsubscribe = onFilterChange(() => {
      effectiveness.update();
      community.update();
    });
    const resize = () => {
      effectiveness.resize();
      community.resize();
    };
    window.addEventListener('resize', resize);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', resize);
      effectiveness.dispose?.();
      community.dispose?.();
      controllersRef.current = {};
      // after sign-out, start the next viewer from a clean slate
      filterBar.replaceChildren();
      setFilters({ year: '', format: '', topic: '', eventId: '' });
    };
  }, [data]);

  useEffect(() => {
    requestAnimationFrame(() => controllersRef.current[activeTab]?.resize());
  }, [activeTab]);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <BrandLogo />
          <div className="topbar-title">
            <h1>{config.community.dashboardTitle}</h1>
            <p className="subtitle">{config.community.subtitle}</p>
          </div>
          <nav className="tabs" role="tablist" aria-label="Dashboard views" hidden={signInMode && !data}>
            <button
              className={`tab${activeTab === 'effectiveness' ? ' active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'effectiveness'}
              aria-controls="dash-eff"
              onClick={() => setActiveTab('effectiveness')}
            >
              {config.navigation.effectiveness}
            </button>
            <button
              className={`tab${activeTab === 'community' ? ' active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'community'}
              aria-controls="dash-comm"
              onClick={() => setActiveTab('community')}
            >
              {config.navigation.community}
            </button>
          </nav>
          {signInMode && user && data && (
            <div className="account">
              <span className="account-email" title={user.name}>{user.email}</span>
              <button type="button" className="account-signout" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <div ref={filterBarRef} className="filterbar" />

      <main>
        {signInMode && !data && (
          <div className="card signin-card">
            <h2>Sign in to view the dashboard</h2>
            <p>
              Use the Google account the reporting sheet is shared with. Data is read live from the sheet
              and kept only in this browser tab.
            </p>
            {signingIn
              ? <div className="status" role="status">Loading data from {config.data.sourceLabel}…</div>
              : <div ref={signInButtonRef} className="signin-button" />}
            {error && (
              <div className="status error" role="alert">
                {error}
                {user && <> <button type="button" className="account-signout" onClick={signOut}>Use another account</button></>}
              </div>
            )}
          </div>
        )}
        {!signInMode && !data && (
          <div className={`status${error ? ' error' : ''}`} role="status">
            {error
              ? error
              : 'Loading dashboard data…'}
          </div>
        )}
        <section
          ref={effectivenessRef}
          id="dash-eff"
          className={`dashboard-panel${activeTab !== 'effectiveness' ? ' inactive' : ''}`}
          role="tabpanel"
          hidden={!data}
        />
        <section
          ref={communityRef}
          id="dash-comm"
          className={`dashboard-panel${activeTab !== 'community' ? ' inactive' : ''}`}
          role="tabpanel"
          hidden={!data}
        />
      </main>

      <footer className="footer">
        <span>
          {data && (signInMode
            ? `Live data from ${data.source.label}, loaded ${new Date(data.generatedAt).toLocaleString()}`
            : `Summarised from ${data.source.label} on ${new Date(data.generatedAt).toLocaleString()}`)}
        </span>
        <span>{config.community.footer}</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
