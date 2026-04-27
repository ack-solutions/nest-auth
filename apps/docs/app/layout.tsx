import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider';
import 'fumadocs-ui/style.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const QUICK_LINKS: [name: string, href: string][] = [
  ['Quickstart — backend',           '/docs/getting-started/quickstart-backend'],
  ['Quickstart — React',             '/docs/getting-started/quickstart-react'],
  ['Quickstart — Next.js',           '/docs/getting-started/quickstart-nextjs'],
  ['Setup checklist',                '/docs/getting-started/setup-checklist'],
  ['Database setup (3 paths)',       '/docs/getting-started/database-setup'],
  ['Sessions & tokens',              '/docs/concepts/sessions-and-tokens'],
  ['User model (NestAuthUser ↔ AppUser)', '/docs/concepts/user-model'],
  ['Multi-tenancy',                  '/docs/concepts/multi-tenancy'],
  ['User Access & Platform Access',  '/docs/concepts/user-access-and-platform-access'],
  ['RBAC',                           '/docs/concepts/rbac'],
  ['MFA',                            '/docs/concepts/mfa'],
  ['Events & Hooks',                 '/docs/concepts/events-and-hooks'],
  ['Multi-platform login recipe',    '/docs/recipes/multi-platform-login'],
  ['Seeding roles & permissions',    '/docs/recipes/seeding-roles-and-permissions'],
  ['Module reference',               '/docs/backend/module'],
  ['Hooks reference',                '/docs/backend/hooks-reference'],
  ['API Reference — endpoints',      '/docs/api-reference'],
];

const TAGS = [
  { name: 'All',             value: undefined },
  { name: 'Getting Started', value: 'start' },
  { name: 'Concepts',        value: 'concepts' },
  { name: 'Authentication',  value: 'auth' },
  { name: 'Backend',         value: 'backend' },
  { name: 'JS Client',       value: 'client' },
  { name: 'React',           value: 'react' },
  { name: 'Production',      value: 'prod' },
  { name: 'Recipes',         value: 'recipes' },
  { name: 'API Reference',   value: 'api' },
  { name: 'FAQ',             value: 'faq' },
];

export const metadata = {
  title: {
    default: 'Nest Auth — Documentation',
    template: '%s · Nest Auth',
  },
  description:
    'Full-featured authentication for NestJS, JS, and React. Sessions, MFA, OAuth, multi-tenant, RBAC, and more.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider
          search={{
            // Pre-load index on first focus so the very first keystroke is fast.
            preload: true,
            // Quick links shown when the search box is empty.
            links: QUICK_LINKS,
            options: {
              // CRITICAL: must be 'static' to match our staticGET route handler.
              // Default is 'fetch', which expects a server route that filters
              // on the query string — and that breaks under `output: 'export'`.
              type: 'static',
              // basePath isn't auto-applied to fetch() URLs in static-export
              // builds — must be supplied explicitly so the search dialog
              // hits the correct asset on GitHub Pages.
              api: `${basePath}/api/search`,
              // Section filters across the top of the dialog.
              tags: TAGS,
              defaultTag: undefined,
              allowClear: true,
              // Light debounce so typing feels instant.
              delayMs: 80,
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
