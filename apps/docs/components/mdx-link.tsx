import Link from 'next/link';
import type { AnchorHTMLAttributes } from 'react';

/**
 * Drop-in replacement for the MDX <a> renderer.
 *
 * - Internal links starting with "/" go through next/link, which prepends
 *   the configured basePath in production (so `/api/nest-auth.json` becomes
 *   `/nest-auth/api/nest-auth.json` on GitHub Pages).
 * - Anchor-only hrefs (#foo) and external/protocol-relative links pass
 *   through to a plain <a>.
 */
export function MdxLink({
  href = '',
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal =
    /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('mailto:');
  const isAnchor = href.startsWith('#');

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noreferrer" {...rest}>
        {children}
      </a>
    );
  }

  if (isAnchor) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  // Internal — let next/link prepend basePath.
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
