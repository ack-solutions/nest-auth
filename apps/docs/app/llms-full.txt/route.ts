import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';

/**
 * `llms-full.txt` — every doc page's raw markdown, concatenated. Intended
 * for prefilling LLM context windows.
 *
 * The list-only companion is at `/llms.txt`.
 */
export const dynamic = 'force-static';
export const revalidate = false;

const CONTENT_ROOT = join(process.cwd(), 'content', 'docs');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      out.push(full);
    }
  }
  return out;
}

function urlFromPath(absPath: string): string {
  let rel = relative(CONTENT_ROOT, absPath).replace(/\\/g, '/');
  rel = rel.replace(/\.mdx$/, '');
  if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length);
  if (rel === 'index' || rel === '') return '/docs';
  return `/docs/${rel}`;
}

export async function GET() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const siteRoot = `https://ack-solutions.github.io${basePath || ''}`;

  const files = (await walk(CONTENT_ROOT)).sort();

  const lines: string[] = [];
  lines.push('# Nest Auth — full documentation');
  lines.push('');
  lines.push(
    `Concatenated raw markdown for every page on ${siteRoot}/. ` +
      'Intended for prefilling LLM context windows. The compact list-only ' +
      `view is at ${siteRoot}/llms.txt.`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const { data, content } = matter(raw);
    const url = urlFromPath(file);

    lines.push(`# ${data.title ?? url}`);
    lines.push('');
    lines.push(`Source: ${siteRoot}${url}/`);
    if (data.description) {
      lines.push('');
      lines.push(`> ${data.description}`);
    }
    lines.push('');
    lines.push(content.trim());
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
