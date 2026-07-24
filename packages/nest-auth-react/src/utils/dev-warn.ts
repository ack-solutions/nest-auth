let warned = false;

/**
 * Dev-only, once-per-session warning emitted when a guard renders nothing purely
 * because auth is "still loading". The usual innocent cause is the initial load
 * (resolves in a tick). The dangerous cause is a DUPLICATED
 * `@ackplus/nest-auth-react` (a pnpm React-version split installs it twice): the
 * `<AuthProvider>` populates one context while the hook reads another that stays
 * on its default `isLoading: true` — so the guard shows a blank page forever with
 * no error. This warning turns that silent failure into a breadcrumb.
 */
export function warnAuthStillLoading(): void {
    if (warned) return;
    // Guard for environments without `process` (some bundlers).
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return;
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
        '[nest-auth-react] a guard is rendering nothing because auth is still loading. ' +
        'If this never resolves, you most likely have duplicate copies of ' +
        '@ackplus/nest-auth-react in your bundle (a pnpm/monorepo React-version split ' +
        'installs it twice) — the provider and the hooks then read different React ' +
        'contexts. Ensure a single React instance and dedupe the package.',
    );
}
