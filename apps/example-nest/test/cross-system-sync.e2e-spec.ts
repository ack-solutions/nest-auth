/**
 * Cross-system sync (e2e) — the consumer's own `app_users` table is kept in sync
 * with the nest-auth user, both ways:
 *
 *   - on signup, a `REGISTERED` event fires and `UserEventListener` upserts an
 *     `AppUser` row (see src/user/user.event-listener.ts);
 *   - `GET /api/profile` reads from BOTH tables (NestAuthUser + AppUser);
 *   - `PATCH /api/profile` writes BOTH, keeping them consistent.
 *
 * This is the pattern a real consumer uses to mirror auth identities into their
 * own domain tables. All assertions go through real HTTP + a real DB query.
 */

import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, type E2EApp } from './utils/test-app';
import { signup, extractTokens, uniqueEmail, bearer, waitFor, userIdFromToken } from './utils/api';
import { AppUser } from '../src/user/user.entity';

describe('Cross-system sync (e2e)', () => {
    let api: E2EApp;
    let appUsers: ReturnType<DataSource['getRepository<AppUser>']>;

    beforeAll(async () => {
        api = await createTestApp();
        appUsers = api.get(DataSource).getRepository(AppUser);
    });

    afterAll(async () => {
        await api.close();
    });

    it('signup mirrors the auth user into the consumer app_users table', async () => {
        const email = uniqueEmail('sync');
        const metadata = { firstName: 'Ada', lastName: 'Lovelace', gender: 'female', dob: '1815-12-10' };

        const res = await signup(api.http, { email, password: 'SyncPass_!1', metadata });
        expect(res.status).toBeLessThan(300);
        const { accessToken } = extractTokens(res.body);
        expect(typeof accessToken).toBe('string');
        const userId = userIdFromToken(accessToken!);

        // The listener runs after the response is sent — poll the real table.
        const row = await waitFor(
            () => appUsers.findOne({ where: { authUserId: userId } }),
            (r) => !!r,
        );
        expect(row).toBeTruthy();
        expect(row!.firstName).toBe('Ada');
        expect(row!.lastName).toBe('Lovelace');
        expect(row!.gender).toBe('female');
    });

    it('GET /api/profile surfaces the synced app_users fields', async () => {
        const email = uniqueEmail('sync-profile');
        const metadata = { firstName: 'Grace', lastName: 'Hopper' };
        const created = await signup(api.http, { email, password: 'SyncPass_!1', metadata });
        const { accessToken } = extractTokens(created.body);

        const profile = await waitFor(
            () => request(api.http).get('/api/profile').set(...bearer(accessToken!)),
            (r) => r.status === 200 && r.body?.firstName === 'Grace',
        );

        expect(profile.status).toBe(200);
        expect(profile.body.firstName).toBe('Grace');
        expect(profile.body.lastName).toBe('Hopper');
        expect(profile.body.email).toBe(email.toLowerCase());
        expect(profile.body.fullName).toBe('Grace Hopper');
    });

    it('PATCH /api/profile updates BOTH the auth metadata and the app_users row', async () => {
        const email = uniqueEmail('sync-update');
        const created = await signup(api.http, {
            email,
            password: 'SyncPass_!1',
            metadata: { firstName: 'Original', lastName: 'Name' },
        });
        const { accessToken } = extractTokens(created.body);
        const userId = userIdFromToken(accessToken!);

        const patch = await request(api.http)
            .patch('/api/profile')
            .set(...bearer(accessToken!))
            .send({ firstName: 'Renamed' });
        expect(patch.status).toBe(200);
        expect(patch.body?.profile?.firstName).toBe('Renamed');

        // The consumer table reflects the change directly (not just the response).
        const row = await appUsers.findOne({ where: { authUserId: userId } });
        expect(row?.firstName).toBe('Renamed');
    });
});
