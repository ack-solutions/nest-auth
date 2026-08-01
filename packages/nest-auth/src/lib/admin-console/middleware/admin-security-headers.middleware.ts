import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Sets defense-in-depth security response headers on EVERY admin-console
 * response (the SPA shell and all admin API routes). Bound to the admin
 * controllers in {@link AdminConsoleModule}.
 *
 * The headline protection is anti-clickjacking: the admin console is the
 * highest-value surface in the product, so a logged-in admin must never be
 * frameable and UI-redressed into a destructive action. A `<meta>` CSP (the
 * only CSP the static bundle could carry) CANNOT set `frame-ancestors`, so it
 * has to be a real response header — hence this middleware.
 *
 * `script-src 'unsafe-inline'` is retained because the admin SPA is a
 * single-file bundle (vite-plugin-singlefile) whose JS/CSS are inlined, plus the
 * server-injected `window.__NEST_AUTH_CONFIG__` bootstrap script. The value that
 * matters for framing (`frame-ancestors 'none'`) is unaffected by that.
 */
@Injectable()
export class AdminSecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    // Clickjacking: legacy header + modern CSP directive (belt and suspenders).
    res.setHeader('X-Frame-Options', 'DENY');
    // MIME-sniffing: never let a response be reinterpreted as an executable type.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Don't leak the (session-bearing) admin URL to third parties via Referer.
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        // The single-file SPA inlines its script/style; keep 'unsafe-inline' so
        // it runs. (Framing protection above does not depend on this.)
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
      ].join('; '),
    );
    next();
  }
}
