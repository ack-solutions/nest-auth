/**
 * Reads the OpenAPI JSON and emits one MDX file per operation under
 *   content/docs/api-reference/(generated)/<tag>/<slug>.mdx
 *
 * Each generated MDX file uses the <EndpointDocs> component to render the
 * full operation interactively. A meta.json per tag groups them in the
 * sidebar.
 *
 * Run: pnpm --filter @ackplus/nest-auth-docs generate:openapi-pages
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SPEC_PATH = resolve(ROOT, 'public', 'api', 'nest-auth.json');
const OUT_DIR = resolve(ROOT, 'content', 'docs', 'api-reference', '(generated)');

type AnyJson = Record<string, any>;

function slugify(s: string) {
  return s
    .replace(/^\//, '')
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function escapeYaml(s: string) {
  return s.replace(/'/g, "''");
}

async function main() {
  const spec = (await import(SPEC_PATH, { with: { type: 'json' } })).default as AnyJson;

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const groups: Record<string, Array<{ slug: string; method: string; path: string; summary: string }>> = {};

  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const method of methods) {
      const op = (item as AnyJson)[method];
      if (!op) continue;

      const tag: string = op.tags?.[0] ?? 'Misc';
      const summary: string = op.summary ?? `${method.toUpperCase()} ${path}`;
      const description: string = op.description ?? '';

      const slug = `${method}-${slugify(path)}`;
      const tagSlug = slugify(tag);

      const dir = resolve(OUT_DIR, tagSlug);
      mkdirSync(dir, { recursive: true });

      const title = `${method.toUpperCase()} ${path}`;
      // First non-empty line of description for the frontmatter description
      const firstLine = description.split('\n').find((l) => l.trim()) ?? summary;
      const trimmedDesc = firstLine.length > 200 ? firstLine.slice(0, 197) + '...' : firstLine;

      const body = `---
title: '${escapeYaml(title)}'
description: '${escapeYaml(trimmedDesc)}'
---

import { EndpointDocs } from '@/components/endpoint-docs';

# ${summary}

<EndpointDocs method="${method}" path="${path}" />
`;

      writeFileSync(resolve(dir, `${slug}.mdx`), body);

      (groups[tagSlug] ||= []).push({ slug, method, path, summary });
    }
  }

  // Per-tag meta.json
  for (const [tagSlug, ops] of Object.entries(groups)) {
    // Sort: GET first, then POST, then path
    ops.sort((a, b) => {
      const order = { get: 0, post: 1, put: 2, patch: 3, delete: 4 } as Record<string, number>;
      const ma = order[a.method] ?? 9;
      const mb = order[b.method] ?? 9;
      if (ma !== mb) return ma - mb;
      return a.path.localeCompare(b.path);
    });

    // Capitalise first letter of the tag for display
    const title = tagSlug.charAt(0).toUpperCase() + tagSlug.slice(1);

    const meta = {
      title,
      pages: ops.map((o) => o.slug),
    };

    writeFileSync(
      resolve(OUT_DIR, tagSlug, 'meta.json'),
      JSON.stringify(meta, null, 2) + '\n',
    );
  }

  // Top-level (generated) meta.json: list each tag dir
  const topMeta = {
    title: 'Endpoints',
    pages: Object.keys(groups).sort(),
  };
  writeFileSync(resolve(OUT_DIR, 'meta.json'), JSON.stringify(topMeta, null, 2) + '\n');

  // Index page for the (generated) tree
  const totalOps = Object.values(groups).reduce((acc, arr) => acc + arr.length, 0);
  const indexBody = `---
title: All Endpoints
description: Generated reference for every operation in the OpenAPI spec.
---

The library exposes ${totalOps} endpoints, grouped below by tag. Each page documents the request body, query / path parameters, every response status code, and a copy-pasteable curl example.

${Object.entries(groups)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([tagSlug, ops]) => {
    const title = tagSlug.charAt(0).toUpperCase() + tagSlug.slice(1);
    const lines = [`## ${title}`, ''];
    for (const op of ops) {
      lines.push(
        `- [\`${op.method.toUpperCase()} ${op.path}\`](/docs/api-reference/${tagSlug}/${op.slug}) — ${op.summary}`,
      );
    }
    lines.push('');
    return lines.join('\n');
  })
  .join('\n')}
`;
  writeFileSync(resolve(OUT_DIR, 'index.mdx'), indexBody);

  console.log(`Generated ${totalOps} endpoint pages across ${Object.keys(groups).length} tags.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
