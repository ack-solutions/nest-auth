import { source } from '@/lib/source';

/**
 * `llms.txt` — concise overview for LLM-powered tools (Claude Code, Cursor,
 * Perplexity, etc.). One line per page, grouped by section. Companion is
 * `/llms-full.txt` which inlines every page body.
 *
 * Spec: https://llmstxt.org/
 */
export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const siteRoot = `https://ack-solutions.github.io${basePath || ''}`;

  const allPages = source.getPages();

  // Group pages by their first sub-path under /docs/.
  const groups = new Map<string, typeof allPages>();
  for (const page of allPages) {
    const m = page.url.match(/^\/docs\/([^/]+)/);
    const key = m?.[1] ?? 'root';
    const list = groups.get(key) ?? [];
    list.push(page);
    groups.set(key, list);
  }

  const SECTION_LABELS: Record<string, string> = {
    introduction:      'Introduction',
    'getting-started': 'Getting Started',
    concepts:          'Core Concepts',
    authentication:    'Authentication Methods',
    backend:           'Backend reference (`@ackplus/nest-auth`)',
    client:            'JS Client reference (`@ackplus/nest-auth-client`)',
    react:             'React reference (`@ackplus/nest-auth-react`)',
    production:        'Production',
    recipes:           'Recipes',
    'api-reference':   'API Reference',
    changelog:         'Changelog',
    faq:               'FAQ & Troubleshooting',
    root:              'Top-level',
  };

  const sectionOrder = [
    'root',
    'introduction',
    'getting-started',
    'concepts',
    'authentication',
    'backend',
    'client',
    'react',
    'production',
    'recipes',
    'api-reference',
    'changelog',
    'faq',
  ];

  const lines: string[] = [];

  lines.push('# Nest Auth');
  lines.push('');
  lines.push(
    '> Full-featured authentication for NestJS, JavaScript, and React. ' +
      'Sessions, MFA, OAuth, passwordless, multi-tenancy, RBAC, and an embedded admin console — type-safe end to end.',
  );
  lines.push('');
  lines.push(`Docs site: ${siteRoot}/`);
  lines.push(`GitHub:    https://github.com/ack-solutions/nest-auth`);
  lines.push(`Packages:  @ackplus/nest-auth, @ackplus/nest-auth-client, @ackplus/nest-auth-react, @ackplus/nest-auth-contracts`);
  lines.push('');
  lines.push('All pages on this site, grouped by section. The companion file at ');
  lines.push(`${siteRoot}/llms-full.txt inlines every page body for context-window prefilling.`);
  lines.push('');

  for (const key of sectionOrder) {
    const pages = groups.get(key);
    if (!pages || pages.length === 0) continue;

    lines.push(`## ${SECTION_LABELS[key] ?? key}`);
    lines.push('');

    // Sort by URL depth then alpha for stable output.
    pages.sort((a, b) => a.url.localeCompare(b.url));

    for (const p of pages) {
      const title = p.data.title ?? p.url;
      const desc = p.data.description ? `: ${p.data.description}` : '';
      lines.push(`- [${title}](${siteRoot}${p.url}/)${desc}`);
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
