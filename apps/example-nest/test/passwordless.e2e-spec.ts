/**
 * Passwordless login (e2e) — email OTP. The code is captured off the emitted
 * `passwordless.code.requested` event. Real codes, real DB, real HTTP.
 */

import request from 'supertest';
import { createTestApp, type E2EApp } from './utils/test-app';
import { extractTokens, uniqueEmail } from './utils/api';

describe('Passwordless login (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    it('send code → login with the code → tokens (auto-signup)', async () => {
        const email = uniqueEmail('passwordless');

        const send = await request(api.http)
            .post('/api/auth/passwordless/send')
            .send({ identifier: email, channel: 'email' });
        expect(send.status).toBeLessThan(300);

        const code = api.events.lastPasswordlessCode();
        expect(typeof code).toBe('string');

        const login = await request(api.http)
            .post('/api/auth/login')
            .send({ providerName: 'passwordless', credentials: { identifier: email, channels: ['email'], code } });
        expect(login.status).toBeLessThan(300);
        expect(typeof extractTokens(login.body).accessToken).toBe('string');
    });

    it('passwordless login with a wrong code → 4xx', async () => {
        const email = uniqueEmail('passwordless-wrong');
        await request(api.http)
            .post('/api/auth/passwordless/send')
            .send({ identifier: email, channel: 'email' });

        const login = await request(api.http)
            .post('/api/auth/login')
            .send({ providerName: 'passwordless', credentials: { identifier: email, channels: ['email'], code: '000000' } });
        expect(login.status).toBeGreaterThanOrEqual(400);
        expect(login.status).toBeLessThan(500);
    });
});
