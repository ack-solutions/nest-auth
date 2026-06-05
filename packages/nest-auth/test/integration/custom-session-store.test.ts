/**
 * Real test that a consumer-supplied session store (`session.store`) is used for
 * the entire session lifecycle. The store below is a genuine working
 * implementation backed by an in-process Map — not a mock; the auth flow calls
 * its methods for every create / lookup / update.
 */
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { SessionStore } from '../../src';
import { bootTestApp, type TestAppHandle } from '../helpers/boot-test-app';

class MapSessionStore implements SessionStore {
    readonly sessions = new Map<string, any>();
    createCalls = 0;
    findByIdCalls = 0;

    async create(session: any) {
        this.createCalls++;
        const id = session.id ?? randomUUID();
        const row = { ...session, id, isActive: true, createdAt: new Date(), lastActiveAt: new Date() };
        this.sessions.set(id, row);
        return row;
    }
    async findById(sessionId: string) {
        this.findByIdCalls++;
        return this.sessions.get(sessionId) ?? null;
    }
    async findByUserId(userId: string) {
        return [...this.sessions.values()].filter((s) => s.userId === userId);
    }
    async findActiveByUserId(userId: string) {
        return [...this.sessions.values()].filter((s) => s.userId === userId && s.isActive !== false);
    }
    async update(sessionId: string, updates: any) {
        const next = { ...(this.sessions.get(sessionId) ?? { id: sessionId }), ...updates };
        this.sessions.set(sessionId, next);
        return next;
    }
    async delete(sessionId: string) {
        this.sessions.delete(sessionId);
    }
    async deleteByUserId(userId: string) {
        for (const [id, s] of this.sessions) if (s.userId === userId) this.sessions.delete(id);
    }
    async deleteExpired() {
        return 0;
    }
    async countActiveByUserId(userId: string) {
        return (await this.findActiveByUserId(userId)).length;
    }
    async updateLastActive(sessionId: string) {
        const s = this.sessions.get(sessionId);
        if (s) {
            s.lastActiveAt = new Date();
            this.sessions.set(sessionId, s);
        }
    }
}

describe('Custom session store (session.store)', () => {
    let handle: TestAppHandle;
    const store = new MapSessionStore();

    beforeAll(async () => {
        handle = await bootTestApp({
            nestAuth: {
                session: {
                    jwt: { secret: 'custom-store-test-secret' },
                    store,
                } as any,
            },
        });
    }, 60_000);

    afterAll(async () => {
        if (handle) await handle.close();
    });

    it('drives the whole session lifecycle through the custom store', async () => {
        const email = 'custom-store@test.local';

        const signup = await request(handle.httpServer)
            .post('/auth/signup')
            .send({ email, password: 'StrongPassword!1' });
        expect(signup.status).toBeLessThan(300);

        // The custom store created the session (no DB table involved).
        expect(store.createCalls).toBeGreaterThan(0);
        expect(store.sessions.size).toBeGreaterThan(0);

        // A guarded call resolves the session through the custom store.
        const me = await request(handle.httpServer)
            .get('/auth/me')
            .set('Authorization', `Bearer ${signup.body.accessToken}`);
        expect(me.status).toBe(200);
        expect(me.body.email).toBe(email);
        expect(store.findByIdCalls).toBeGreaterThan(0);
    });
});
