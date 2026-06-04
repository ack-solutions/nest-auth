import { Controller, Get, Logger, OnModuleInit, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { AdminConsoleConfigService } from '../services/admin-console-config.service';

const candidateStaticRoots = [
  // Primary — relative to THIS compiled module. Works for both the published
  // package (dist/lib/admin-console/controllers → ../static = dist/lib/admin-console/static)
  // and ts-source dev runs (src/lib/admin-console/controllers → ../static).
  // `@ackplus/nest-auth-admin`'s `vite build` outputs index.html here.
  join(__dirname, '..', 'static'),
  // Fallbacks for unusual consumer build layouts (best-effort, cwd-relative).
  join(process.cwd(), 'node_modules', '@ackplus', 'nest-auth', 'dist', 'lib', 'admin-console', 'static'),
  join(process.cwd(), 'packages', 'nest-auth', 'dist', 'lib', 'admin-console', 'static'),
  join(process.cwd(), 'packages', 'nest-auth', 'src', 'lib', 'admin-console', 'static'),
];

/** Returns the first root that actually contains a built index.html, or null. */
function resolveStaticRoot(): string | null {
  for (const root of candidateStaticRoots) {
    if (existsSync(join(root, 'index.html'))) {
      return root;
    }
  }
  return null;
}

@Controller('auth/admin')
export class AdminConsoleController implements OnModuleInit {
  private readonly logger = new Logger(AdminConsoleController.name);
  private cachedIndexHtml: string | null = null;
  private readonly staticRoot = resolveStaticRoot();
  private readonly indexPath = this.staticRoot ? join(this.staticRoot, 'index.html') : null;

  constructor(private readonly config: AdminConsoleConfigService) { }

  onModuleInit() {
    if (this.config.getConfig().enabled === false) {
      return;
    }
    if (!this.indexPath) {
      // Not an error — normal for API-only consumers, or before the dashboard
      // UI has been built. The admin REST API under /auth/admin/api/* still works.
      this.logger.warn(
        'Admin console UI bundle not found (no static/index.html). The admin API still works; ' +
        'run `pnpm -F @ackplus/nest-auth-admin build` to serve the dashboard at /auth/admin.',
      );
      return;
    }
    try {
      this.cachedIndexHtml = readFileSync(this.indexPath, 'utf8');
      this.logger.log('Admin console UI bundle loaded');
    } catch (error) {
      this.logger.warn(
        `Admin console UI bundle could not be read at ${this.indexPath}: ${error.message}`,
      );
    }
  }

  @Get()
  async serveIndex(@Res() res: Response) {
    this.config.ensureEnabled();

    if (!this.cachedIndexHtml) {
      // The dashboard UI isn't bundled in this build — respond clearly instead
      // of a bare 500. The admin REST API under /auth/admin/api/* is unaffected.
      res
        .status(404)
        .type('text/plain')
        .send(
          'Admin console UI is not bundled in this build. The admin API is available under ' +
          '/auth/admin/api/*. To serve the dashboard UI, build @ackplus/nest-auth-admin.',
        );
      return;
    }

    try {
      let content = this.cachedIndexHtml;

      const basePath = this.config.getBasePath();
      const config = { basePath };
      const js = `window.__NEST_AUTH_CONFIG__ = ${JSON.stringify(config)};`;

      // Inject external config script tag to satisfy CSP (no inline script)
      const configScriptTag = `<script>${js}</script>`;

      // Insert config script before closing </head> tag or at the start of <body>
      if (content.includes('<head>')) {
        content = content.replace('<head>', `${configScriptTag}<head>`);
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(content);
    } catch (error) {
      this.logger.error('Failed to serve admin console index.html', { path: this.indexPath, message: error.message }, error.stack);
      res.status(500).send('Internal Server Error');
    }
  }

}
