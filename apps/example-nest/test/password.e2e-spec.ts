/**
 * Password management (e2e) — forgot/reset flow and authenticated change-password.
 *
 * The plaintext reset OTP is read off the emitted `password_reset_requested`
 * event (no SMTP needed) — real codes, real DB, real HTTP.
 */

import request from 'supertest';
import { createTestApp, type E2EApp } from './utils/test-app';
import { signup, loginEmail, extractTokens, uniqueEmail, bearer } from './utils/api';

describe('Password management (e2e)', () => {
    let api: E2EApp;

    beforeAll(async () => {
        api = await createTestApp();
    });

    afterAll(async () => {
        await api.close();
    });

    it('forgot → verify-otp → reset → login with the new password', async () => {
        const email = uniqueEmail('reset');
        const oldPassword = 'OldPassword!1';
        const newPassword = 'BrandNewPassword!2';
        await signup(api.http, { email, password: oldPassword });

        // 1. request a reset code
        const forgot = await request(api.http).post('/api/auth/forgot-password').send({ email });
        expect(forgot.status).toBeLessThan(300);

        const code = api.events.lastPasswordResetCode();
        expect(typeof code).toBe('string');

        // 2. exchange the code for a reset token
        const verify = await request(api.http)
            .post('/api/auth/verify-forgot-password-otp')
            .send({ email, code });
        expect(verify.status).toBeLessThan(300);
        const resetToken = verify.body.resetToken ?? verify.body.token;
        expect(typeof resetToken).toBe('string');

        // 3. set the new password
        const reset = await request(api.http)
            .post('/api/auth/reset-password')
            .send({ token: resetToken, newPassword });
        expect(reset.status).toBeLessThan(300);

        // 4. new password works, old one is rejected
        const newLogin = await loginEmail(api.http, email, newPassword);
        expect(newLogin.status).toBeLessThan(300);
        expect(typeof extractTokens(newLogin.body).accessToken).toBe('string');

        const oldLogin = await loginEmail(api.http, email, oldPassword);
        expect(oldLogin.status).toBe(401);
    });

    it('forgot-password for an unknown email returns 2xx and emits no code (no enumeration)', async () => {
        api.events.clear();
        const res = await request(api.http)
            .post('/api/auth/forgot-password')
            .send({ email: uniqueEmail('ghost') });
        expect(res.status).toBeLessThan(300);
        expect(api.events.lastPasswordResetCode()).toBeUndefined();
    });

    it('reset-password with a bogus token → 4xx', async () => {
        const res = await request(api.http)
            .post('/api/auth/reset-password')
            .send({ token: 'not-a-real-reset-token', newPassword: 'Whatever!123' });
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
    });

    it('change-password requires the correct current password', async () => {
        const email = uniqueEmail('changepw');
        const password = 'CurrentPass!1';
        const created = await signup(api.http, { email, password });
        const { accessToken } = extractTokens(created.body);

        // wrong current password → rejected
        const wrong = await request(api.http)
            .post('/api/auth/change-password')
            .set(...bearer(accessToken!))
            .send({ currentPassword: 'WrongCurrent!9', newPassword: 'NewPass!2' });
        expect(wrong.status).toBeGreaterThanOrEqual(400);
        expect(wrong.status).toBeLessThan(500);

        // correct current password → success, and the new password then logs in
        const ok = await request(api.http)
            .post('/api/auth/change-password')
            .set(...bearer(accessToken!))
            .send({ currentPassword: password, newPassword: 'NewPass!2' });
        expect(ok.status).toBeLessThan(300);

        const relogin = await loginEmail(api.http, email, 'NewPass!2');
        expect(relogin.status).toBeLessThan(300);
    });
});
