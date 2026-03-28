import { config } from 'dotenv';
import { resolve } from 'path';

// Resolve .env next to the app package (not process.cwd()), so `pnpm ... dev` from the monorepo root still finds apps/example-nest/.env
config({ path: resolve(__dirname, '../.env') });
