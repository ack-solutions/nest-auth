import { createContext, type Context } from 'react';

/**
 * `createContext` that returns the SAME context object even if this package is
 * DUPLICATED in the bundle (a pnpm/monorepo peer-React version split — e.g. one
 * lib resolves `react@18` and the app `react@19` — can install
 * `@ackplus/nest-auth-react` twice). Without this, each copy would call
 * `createContext()` and get its own context object: `<AuthProvider>` from copy A
 * populates copy A's context, but a hook imported from copy B reads copy B's
 * still-default context → `isLoading` stuck `true` forever → silent blank pages.
 *
 * We key the context on `globalThis` via `Symbol.for(...)` so every duplicate
 * copy shares one context object. This is safe because React itself is expected
 * to be a single instance (it's a `peerDependency` + consumers dedupe it); only
 * the context *identity* breaks under duplication, so that's all we pin.
 */
export function createSingletonContext<T>(key: string, defaultValue: T): Context<T> {
    const symbol = Symbol.for(`@ackplus/nest-auth-react:${key}`);
    const store = globalThis as unknown as Record<symbol, Context<T> | undefined>;
    return (store[symbol] ??= createContext<T>(defaultValue));
}
