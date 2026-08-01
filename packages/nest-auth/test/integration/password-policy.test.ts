/**
 * Regression tests for the password policy + HIBP breach check.
 *
 * NO MOCKS. Real NestJS + real DB. The HIBP check hits a REAL local HTTP server
 * that speaks the Pwned Passwords range protocol (`GET /<prefix>` → `SUFFIX:count`
 * lines), pointed at via `password.policy.hibp.baseUrl`. Real `fetch`, real SHA-1.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const sha1Upper = (s: string) => createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase();

// A password that our fake HIBP will report as breached, and one it won't.
const BREACHED_PW = 'Br3ached-Passphrase!';
const CLEAN_PW = 'Fresh-Passphrase!42x';
const breachedHash = sha1Upper(BREACHED_PW);
const breachedPrefix = breachedHash.slice(0, 5);
const breachedSuffix = breachedHash.slice(5);

let server: Server;
let hibpBaseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const prefix = (req.url ?? '/').slice(1).toUpperCase();
    const lines: string[] = [];
    // Only the breached password's prefix returns its suffix (count > 0).
    if (prefix === breachedPrefix) lines.push(`${breachedSuffix}:42`);
    lines.push('0000000000000000000000000000000000000:0'); // padding row (count 0)
    res.statusCode = 200;
    res.end(lines.join('\r\n'));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  hibpBaseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

describe('password policy — HIBP breach check', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        password: {
          policy: { enabled: true, checkBreached: true, hibp: { baseUrl: hibpBaseUrl } },
        },
      } as any,
    });
  });
  afterEach(async () => { await handle.close(); });

  it('rejects a breached password (PASSWORD_BREACHED)', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'hibp-bad@test.local', password: BREACHED_PW });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('PASSWORD_BREACHED');
  });

  it('accepts a clean password', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'hibp-good@test.local', password: CLEAN_PW });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  });
});

describe('password policy — minLength (above the DTO floor)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({ nestAuth: { password: { policy: { enabled: true, minLength: 12 } } } as any });
  });
  afterEach(async () => { await handle.close(); });

  it('rejects a password shorter than policy.minLength (PASSWORD_TOO_SHORT)', async () => {
    // 'Abcd1234' (8 chars) passes the DTO @MinLength(8) but fails policy minLength 12.
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'pp-short@test.local', password: 'Abcd1234' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('PASSWORD_TOO_SHORT');
  });
});

describe('password policy — offline checks (common / identifier)', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({ nestAuth: { password: { policy: { enabled: true, minLength: 8 } } } as any });
  });
  afterEach(async () => { await handle.close(); });

  const signup = (email: string, password: string) =>
    request(handle.httpServer).post('/auth/signup').send({ email, password });

  it('rejects a common password', async () => {
    const res = await signup('pp-common@test.local', 'password');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('PASSWORD_TOO_COMMON');
  });

  it('rejects a password containing the email local-part', async () => {
    const res = await signup('contains@test.local', 'contains12345');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('PASSWORD_CONTAINS_IDENTIFIER');
  });

  it('accepts a strong password', async () => {
    const res = await signup('pp-ok@test.local', 'A-Strong-Passphrase-9');
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  });
});

describe('password policy — HIBP fail-open on outage', () => {
  let handle: TestAppHandle;
  beforeEach(async () => {
    handle = await bootTestApp({
      nestAuth: {
        password: {
          // Point at a dead port; failOpen defaults true → the check must not block.
          policy: { enabled: true, checkBreached: true, hibp: { baseUrl: 'http://127.0.0.1:1', timeoutMs: 500 } },
        },
      } as any,
    });
  });
  afterEach(async () => { await handle.close(); });

  it('allows the signup when HIBP is unreachable', async () => {
    const res = await request(handle.httpServer)
      .post('/auth/signup')
      .send({ email: 'hibp-down@test.local', password: 'A-Strong-Passphrase-9' });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  });
});
