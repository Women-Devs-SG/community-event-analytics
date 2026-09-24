/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'synthetic' | 'google-sheets' | 'google-signin';
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
  readonly VITE_APPS_SCRIPT_URL?: string;
  readonly VITE_REPORTING_TIMEZONE?: string;
  readonly VITE_SOURCE_LABEL?: string;
  readonly VITE_COMMUNITY_NAME?: string;
  readonly VITE_COMMUNITY_SHORT_NAME?: string;
  readonly VITE_COMMUNITY_LOCATION?: string;
  readonly VITE_DASHBOARD_TITLE?: string;
  readonly VITE_DASHBOARD_SUBTITLE?: string;
  readonly VITE_DASHBOARD_FOOTER?: string;
  readonly VITE_COLOR_SURFACE?: string;
  readonly VITE_COLOR_CARD?: string;
  readonly VITE_COLOR_INK?: string;
  readonly VITE_COLOR_PRIMARY?: string;
  readonly VITE_COLOR_SECONDARY?: string;
  readonly VITE_COLOR_ACCENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
