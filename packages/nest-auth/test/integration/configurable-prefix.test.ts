/**
 * Real tests that the auth route prefix and admin dashboard path are
 * configurable (default 'auth' / 'admin' is preserved elsewhere).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

const ADMIN_SECRET = 'configurable-prefix-admin-secret';

describe('Configurable auth prefix + admin path', () => {
    let handle: TestAppHandle;

    beforeAll(async () => {
        handle = await bootTestApp({
            nestAuth: {
                routePrefix: 'account',
                adminConsole: {
                    enabled: true,
                    path: 'manage',
                    secretKey: ADMIN_SECRET,
                } as any,
            },
        });
    }, 60_000);

    afterAll(async () => {
        if (handle) await handle.close();
    });

    it('serves auth routes under the custom prefix', async () => {
        const res = await request(handle.httpServer)
            .post('/account/signup')
            .send({ email: 'prefix@test.local', password: 'StrongPassword!1' });
        expect(res.status).toBeLessThan(300);
        expect(res.body.accessToken).toBeTruthy();
    });

    it('no longer serves auth under the default /auth prefix', async () => {
        const res = await request(handle.httpServer)
            .post('/auth/signup')
            .send({ email: 'old@test.local', password: 'StrongPassword!1' });
        expect(res.status).toBe(404);
    });

    it('serves the admin console under the custom admin path', async () => {
        const res = await request(handle.httpServer)
            .post('/account/manage/signup')
            .send({
                email: 'admin@test.local',
                password: 'AdminPass!1',
                name: 'Admin',
                secretKey: ADMIN_SECRET,
            });
        expect(res.status).toBeLessThan(300);
    });

    it('admin console is not at the default /auth/admin path', async () => {
        const res = await request(handle.httpServer)
            .post('/auth/admin/signup')
            .send({ email: 'x@test.local', password: 'AdminPass!1', name: 'X', secretKey: ADMIN_SECRET });
        expect(res.status).toBe(404);
    });
});
