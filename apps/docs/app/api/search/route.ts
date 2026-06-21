import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

/**
 * Static search index. Built once at export time, fetched whole by the
 * client-side dialog (which then runs Orama in-browser).
 *
 * The dialog must be configured with `type: 'static'` (see app/layout.tsx)
 * for this to work — the default is `'fetch'`, which expects a server route
 * that filters on the request.
 */
export const dynamic = 'force-static';
export const revalidate = false;

const SECTION_TAG_MAP: Record<string, { tag: string; label: string }> = {
  introduction:    { tag: 'intro',         label: 'Introduction'      },
  'getting-started': { tag: 'start',       label: 'Getting Started'   },
  concepts:        { tag: 'concepts',      label: 'Core Concepts'     },
  authentication:  { tag: 'auth',          label: 'Authentication'    },
  backend:         { tag: 'backend',       label: 'Backend'           },
  client:          { tag: 'client',        label: 'JS Client'         },
  react:           { tag: 'react',         label: 'React'             },
  'react-native':  { tag: 'react-native',  label: 'React Native'      },
  flutter:         { tag: 'flutter',       label: 'Flutter'           },
  production:      { tag: 'prod',          label: 'Production'        },
  recipes:         { tag: 'recipes',       label: 'Recipes'           },
  'api-reference': { tag: 'api',           label: 'API Reference'     },
  migration:       { tag: 'migration',     label: 'Migration'         },
  changelog:       { tag: 'changelog',     label: 'Changelog'         },
  faq:             { tag: 'faq',           label: 'FAQ'               },
};

function deriveTag(url: string): string | undefined {
  // url is like "/docs/concepts/sessions-and-tokens"
  const m = url.match(/^\/docs\/([^/]+)/);
  if (!m) return undefined;
  return SECTION_TAG_MAP[m[1]]?.tag;
}

export const { staticGET: GET } = createFromSource(source, (page) => ({
  id: page.url,
  url: page.url,
  title: page.data.title,
  description: page.data.description,
  structuredData: page.data.structuredData,
  tag: deriveTag(page.url),
}));
