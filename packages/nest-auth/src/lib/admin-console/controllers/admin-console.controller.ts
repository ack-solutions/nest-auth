import { Controller, Get, Logger, OnModuleInit, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { AdminConsoleConfigService } from '../services/admin-console-config.service';

const candidateStaticRoots = [
  // When the library itself is built (dist/packages/nest-auth/...)
  join(__dirname, '..', 'static'),
  // When the library is consumed via ts-node/tsconfig paths during development
  join(process.cwd(), 'packages', 'nest-auth', 'src', 'lib', 'admin-console', 'static'),
  // When the consumer (apps/nest-examples) compiles everything into dist/apps/...
  join(process.cwd(), 'dist', 'apps', 'nest-examples', 'packages', 'nest-auth', 'src', 'lib', 'admin-console', 'static'),
  // Generic fallback: dist/packages/... in monorepo root
  join(process.cwd(), 'dist', 'packages', 'nest-auth', 'src', 'lib', 'admin-console', 'static'),
];

function resolveStaticRoot(): string {
  for (const root of candidateStaticRoots) {
    if (existsSync(join(root, 'index.html'))) {
      return root;
    }
  }
  return candidateStaticRoots[1];
}

@Controller('auth/admin')
export class AdminConsoleController implements OnModuleInit {
  private readonly logger = new Logger(AdminConsoleController.name);
  private cachedIndexHtml: string | null = null;
  private staticRoot = resolveStaticRoot();
  private readonly indexPath = join(this.staticRoot, 'index.html');

  constructor(private readonly config: AdminConsoleConfigService) { }

  onModuleInit() {
    if (this.config.getConfig().enabled === false) {
      return;
    }
    if (!existsSync(this.indexPath)) {
      this.logger.error('Admin console index.html not found at startup', { path: this.indexPath });
      throw new Error(`Admin console index.html not found at ${this.indexPath}`);
    }
    try {
      this.cachedIndexHtml = readFileSync(this.indexPath, 'utf8');
      this.logger.log('Admin console index.html cached successfully');
    } catch (error) {
      this.logger.error('Failed to read admin console index.html on startup', { path: this.indexPath, message: error.message }, error.stack);
    }
  }

  @Get()
  async serveIndex(@Res() res: Response) {
    this.config.ensureEnabled();

    if (!this.cachedIndexHtml) {
      this.logger.error('Cached index.html is not available');
      res.status(500).send('Internal Server Error');
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
