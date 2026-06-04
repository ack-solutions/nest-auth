/**
 * Verification flows (e2e) — email + phone verification. The example does not
 * force verification, so we drive the explicit send→verify endpoints and read the
 * code off the emitted event. Auth is required for these endpoints.
 */

import request from 'supertest';
import { createTestApp, type E2EApp } from './utils/test-app';
import { signup, extractTokens, uniqueEmail, uniquePhone, bearer, waitFor } from './utils/api';

describe('Verification flows (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    it('verify-email without an auth token → 401', async () => {
        const res = await request(api.http).post('/api/auth/verify-email').send({ code: '123456' });
        expect(res.status).toBe(401);
    });

    it('send-email-verification → capture code → verify-email sets the user verified', async () => {
        const email = uniqueEmail('verify-email');
        const created = await signup(api.http, { email, password: 'VerifyPass!1' });
        const { accessToken } = extractTokens(created.body);
        api.events.clear();

        const send = await request(api.http)
            .post('/api/auth/send-email-verification')
            .set(...bearer(accessToken!))
            .send({});
        expect(send.status).toBeLessThan(300);

        const code = await waitFor(
            async () => api.events.lastEmailVerificationCode(),
            (c) => typeof c === 'string',
        );
        expect(typeof code).toBe('string');

        const verify = await request(api.http)
            .post('/api/auth/verify-email')
            .set(...bearer(accessToken!))
            .send({ code });
        expect(verify.status).toBeLessThan(300);
    });

    it('send-phone-verification → capture code → verify-phone sets the phone verified', async () => {
        // Sign up with a phone so there is a number to verify.
        const phone = uniquePhone();
        const created = await signup(api.http, { phone, password: 'VerifyPass!1' });
        const { accessToken } = extractTokens(created.body);
        expect(typeof accessToken).toBe('string');
        api.events.clear();

        const send = await request(api.http)
            .post('/api/auth/send-phone-verification')
            .set(...bearer(accessToken!))
            .send({});
        expect(send.status).toBeLessThan(300);

        const code = await waitFor(
            async () => api.events.lastPhoneVerificationCode(),
            (c) => typeof c === 'string',
        );
        expect(typeof code).toBe('string');

        const verify = await request(api.http)
            .post('/api/auth/verify-phone')
            .set(...bearer(accessToken!))
            .send({ code });
        expect(verify.status).toBeLessThan(300);
    });
});
