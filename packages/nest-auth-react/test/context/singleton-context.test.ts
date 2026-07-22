/**
 * Real, no-mock regression test for the duplicate-package bug.
 *
 * When `@ackplus/nest-auth-react` is installed twice (a pnpm/monorepo peer-React
 * version split can double-install it), each copy runs its own module code and
 * would call `createContext()` again — giving `<AuthProvider>` and the hooks two
 * DIFFERENT React contexts. Consumers then stay stuck on the default
 * `isLoading: true` and permission guards render blank pages forever, with no
 * error. `createSingletonContext` pins each context on `globalThis` via
 * `Symbol.for(...)`, so every duplicate copy shares ONE context object.
 *
 * We reproduce "installed twice" by re-importing the same modules under a
 * cache-busting query string: Vitest keys its module graph by full id
 * (path + query), so `?dup` genuinely re-executes the top-level
 * `createSingletonContext(...)` calls — exactly what a second install does. The
 * contexts must still be referentially identical (`===`).
 */
import { describe, it, expect } from 'vitest';
import { createContext } from 'react';

import { AuthContext } from '../../src/context/auth-context';
import { AccountSwitcherContext } from '../../src/account/account-switcher-context';
import { createSingletonContext } from '../../src/utils/singleton-context';

describe('duplication-safe React contexts (singleton)', () => {
    it('AuthContext is identical across a duplicate module resolution', async () => {
        const dup = await import('../../src/context/auth-context?dup');
        expect(dup.AuthContext).toBe(AuthContext);
    });

    it('AccountSwitcherContext is identical across a duplicate module resolution', async () => {
        const dup = await import('../../src/account/account-switcher-context?dup');
        expect(dup.AccountSwitcherContext).toBe(AccountSwitcherContext);
    });

    it('createSingletonContext returns the SAME context for the same key', () => {
        const a = createSingletonContext('DupCheck', { v: 1 });
        const b = createSingletonContext('DupCheck', { v: 2 });
        expect(b).toBe(a);
    });

    it('createSingletonContext returns DIFFERENT contexts for different keys', () => {
        const a = createSingletonContext('KeyA', null);
        const b = createSingletonContext('KeyB', null);
        expect(a).not.toBe(b);
    });

    it('a plain createContext() call is NOT shared (proves the bug this guards against is real)', () => {
        const one = createContext(null);
        const two = createContext(null);
        expect(one).not.toBe(two);
    });
});
