export type DatasetKey = 'events' | 'surveyResponses' | 'feedbackAnswers' | 'registrations' | 'participants';
export type FeedbackRoleId = 'positive' | 'improvement' | 'topic_request';
export type SegmentId = 'experience' | 'gender' | 'jobFamily' | 'sector' | 'organization';

export interface SegmentConfig {
  label: string;
  shortLabel: string;
  registrationField: 'experience_segment' | 'gender_segment' | 'job_family_segment' | 'sector_segment' | 'organization_segment';
  responseField: 'experience_segment' | null;
  order: readonly string[];
  unknownLabel: string;
}

export interface CommunityConfig {
  community: {
    name: string;
    shortName: string;
    locationLabel: string;
    dashboardTitle: string;
    subtitle: string;
    footer: string;
  };
  navigation: { effectiveness: string; community: string };
  terminology: {
    participant: string;
    participants: string;
    registration: string;
    registrations: string;
    event: string;
    events: string;
  };
  data: {
    sourceKind: 'synthetic' | 'google-sheets' | 'google-signin';
    sourceLabel: string;
    reportingTimezone: string;
    googleSignIn: { clientId: string; appsScriptUrl: string };
    fieldAliases: Record<DatasetKey, Record<string, readonly string[]>>;
  };
  branding: {
    surface: string;
    card: string;
    ink: string;
    primary: string;
    secondary: string;
    accent: string;
    chart: readonly [string, string, string, string, string];
  };
  feedbackRoles: readonly { id: FeedbackRoleId; label: string; sourceValues: readonly string[] }[];
  ratings: {
    satisfaction: {
      min: number;
      max: number;
      verdictPositiveMin: number;
      verdictNeutralMin: number;
      promoterMin: number;
      passiveMin: number;
    };
    recommendation: { min: number; max: number };
  };
  segments: Record<SegmentId, SegmentConfig>;
  privacy: { excludedOrganisations: readonly string[]; minimumSegmentSize: number };
}

// Read each variable by name. Referencing import.meta.env as a whole object
// would make Vite inline every VITE_ variable into the browser bundle.
// Sheet access settings for the build (sheet ID, tab names, service-account
// key) are not read here: they are build-only and live in src/summary/generate.ts.
const env = {
  VITE_COMMUNITY_NAME: import.meta.env.VITE_COMMUNITY_NAME,
  VITE_COMMUNITY_SHORT_NAME: import.meta.env.VITE_COMMUNITY_SHORT_NAME,
  VITE_COMMUNITY_LOCATION: import.meta.env.VITE_COMMUNITY_LOCATION,
  VITE_DASHBOARD_TITLE: import.meta.env.VITE_DASHBOARD_TITLE,
  VITE_DASHBOARD_SUBTITLE: import.meta.env.VITE_DASHBOARD_SUBTITLE,
  VITE_DASHBOARD_FOOTER: import.meta.env.VITE_DASHBOARD_FOOTER,
  VITE_DATA_SOURCE: import.meta.env.VITE_DATA_SOURCE,
  VITE_SOURCE_LABEL: import.meta.env.VITE_SOURCE_LABEL,
  VITE_REPORTING_TIMEZONE: import.meta.env.VITE_REPORTING_TIMEZONE,
  VITE_GOOGLE_OAUTH_CLIENT_ID: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
  VITE_APPS_SCRIPT_URL: import.meta.env.VITE_APPS_SCRIPT_URL,
  VITE_COLOR_SURFACE: import.meta.env.VITE_COLOR_SURFACE,
  VITE_COLOR_CARD: import.meta.env.VITE_COLOR_CARD,
  VITE_COLOR_INK: import.meta.env.VITE_COLOR_INK,
  VITE_COLOR_PRIMARY: import.meta.env.VITE_COLOR_PRIMARY,
  VITE_COLOR_SECONDARY: import.meta.env.VITE_COLOR_SECONDARY,
  VITE_COLOR_ACCENT: import.meta.env.VITE_COLOR_ACCENT,
};
const configuredName = env.VITE_COMMUNITY_NAME || 'Sample Community';

export const communityConfig = {
  community: {
    name: configuredName,
    shortName: env.VITE_COMMUNITY_SHORT_NAME || 'SC',
    locationLabel: env.VITE_COMMUNITY_LOCATION || 'Demo',
    dashboardTitle: env.VITE_DASHBOARD_TITLE || 'Community Event Analytics',
    subtitle: env.VITE_DASHBOARD_SUBTITLE || 'Synthetic demo data · connect your community source to get started',
    footer: env.VITE_DASHBOARD_FOOTER || 'Open-source community analytics starter · synthetic data only',
  },
  navigation: {
    effectiveness: 'Event effectiveness',
    community: 'Community profile',
  },
  terminology: {
    participant: 'participant',
    participants: 'participants',
    registration: 'registration',
    registrations: 'registrations',
    event: 'event',
    events: 'events',
  },
  data: {
    sourceKind: env.VITE_DATA_SOURCE === 'google-sheets' || env.VITE_DATA_SOURCE === 'google-signin' ? env.VITE_DATA_SOURCE : 'synthetic',
    sourceLabel: env.VITE_DATA_SOURCE === 'google-sheets' || env.VITE_DATA_SOURCE === 'google-signin'
      ? (env.VITE_SOURCE_LABEL || 'Google Sheets')
      : 'Synthetic demo data',
    // google-signin only: viewers sign in with Google, and the Apps Script web app
    // (apps-script/Code.gs) returns the sheet's rows to people it is shared with.
    // Neither value grants access on its own.
    googleSignIn: {
      clientId: env.VITE_GOOGLE_OAUTH_CLIENT_ID || '',
      appsScriptUrl: env.VITE_APPS_SCRIPT_URL || '',
    },
    reportingTimezone: env.VITE_REPORTING_TIMEZONE || 'UTC',
    // Canonical fields are read first, followed by these accepted source aliases.
    fieldAliases: {
      events: {
        event_name: ['title', 'session_name'],
      },
      surveyResponses: {
        satisfaction: ['satisfaction_1_10'],
        recommend: ['recommend_1_10'],
        experience_segment: ['years_exp'],
      },
      feedbackAnswers: { question_role: ['canonical_field'] },
      registrations: {
        participant_id: ['registrant_hash'],
        gender_segment: ['gender'],
        sector_segment: ['sector'],
        job_family_segment: ['job_family'],
        experience_segment: ['years_experience_bucket'],
        organization_segment: ['org_normalised'],
      },
      participants: {
        participant_id: ['registrant_hash'],
        is_returning_attended: ['is_returning'],
      },
    },
  },
  branding: {
    surface: env.VITE_COLOR_SURFACE || '#f7f8fb',
    card: env.VITE_COLOR_CARD || '#ffffff',
    ink: env.VITE_COLOR_INK || '#172033',
    primary: env.VITE_COLOR_PRIMARY || '#3157c8',
    secondary: env.VITE_COLOR_SECONDARY || '#0f766e',
    accent: env.VITE_COLOR_ACCENT || '#d97706',
    chart: ['#3157c8', '#0f766e', '#d97706', '#a855f7', '#e05678'],
  },
  feedbackRoles: [
    { id: 'positive', label: 'What worked well', sourceValues: ['positive', 'text_good'] },
    { id: 'improvement', label: 'What could improve', sourceValues: ['improvement', 'text_improve'] },
    { id: 'topic_request', label: 'Requested next', sourceValues: ['topic_request', 'text_interest'] },
  ],
  ratings: {
    satisfaction: {
      min: 1,
      max: 10,
      verdictPositiveMin: 8,
      verdictNeutralMin: 6,
      promoterMin: 9,
      passiveMin: 7,
    },
    recommendation: { min: 1, max: 10 },
  },
  segments: {
    experience: {
      label: 'Experience level', shortLabel: 'Experience', registrationField: 'experience_segment', responseField: 'experience_segment',
      order: ['Student', '0-2', '3-5', '6-10', '10+', 'Not stated'], unknownLabel: 'Not stated',
    },
    gender: {
      label: 'Gender', shortLabel: 'Gender', registrationField: 'gender_segment', responseField: null,
      order: ['Female', 'Male', 'Other', 'Not stated'], unknownLabel: 'Not stated',
    },
    jobFamily: {
      label: 'Job family', shortLabel: 'Job family', registrationField: 'job_family_segment', responseField: null,
      order: [], unknownLabel: 'Unmapped',
    },
    sector: {
      label: 'Sector', shortLabel: 'Sector', registrationField: 'sector_segment', responseField: null,
      order: ['Private', 'Public', 'Academia', 'Non-profit', 'Self-employed', 'Not stated'], unknownLabel: 'Not stated',
    },
    organization: {
      label: 'Organization', shortLabel: 'Organization', registrationField: 'organization_segment', responseField: null,
      order: [], unknownLabel: 'Not stated',
    },
  },
  privacy: {
    excludedOrganisations: [`${configuredName} team`.toLowerCase()],
    minimumSegmentSize: 10,
  },
} as const satisfies CommunityConfig;

export const surveyExperienceOrder = ['0-1 year', '2-3 years', '3-4 years', '5-6 years', '7+ years', 'Not stated'] as const;
