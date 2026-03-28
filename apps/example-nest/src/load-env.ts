import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/** `.env` next to this app's package.json (works for `nest start` from src/ and `node dist/main`). */
const envPath = resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
    config({ path: envPath });
}
