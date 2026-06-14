/**
 * Framework-agnostic external store over an {@link AccountManager}, shaped for
 * React's `useSyncExternalStore`. Kept separate from the hook so the reactive
 * core (referential stability + notify-on-change) is testable without a DOM.
 */
import type { AccountManager, AccountSnapshot } from '@ackplus/nest-auth-client';

export interface AccountSwitcherSnapshot {
    accounts: AccountSnapshot[];
    activeAccountId: string | null;
    activeAccount: AccountSnapshot | null;
}

export interface AccountSwitcherStore {
    subscribe(onChange: () => void): () => void;
    /** Returns a referentially-stable snapshot — unchanged identity when nothing changed. */
    getSnapshot(): AccountSwitcherSnapshot;
}

function snapshotsEqual(
    prev: AccountSwitcherSnapshot,
    accounts: AccountSnapshot[],
    activeAccountId: string | null,
): boolean {
    if (prev.activeAccountId !== activeAccountId) return false;
    if (prev.accounts.length !== accounts.length) return false;
    for (let i = 0; i < accounts.length; i++) {
        const a = prev.accounts[i];
        const b = accounts[i];
        if (
            a.accountId !== b.accountId ||
            a.isActive !== b.isActive ||
            a.label !== b.label ||
            a.email !== b.email
        ) {
            return false;
        }
    }
    return true;
}

export function createAccountSwitcherStore(manager: AccountManager): AccountSwitcherStore {
    let cache: AccountSwitcherSnapshot | null = null;

    const getSnapshot = (): AccountSwitcherSnapshot => {
        const accounts = manager.listAccounts();
        const activeAccountId = manager.getActiveAccountId();
        if (cache && snapshotsEqual(cache, accounts, activeAccountId)) {
            return cache; // stable identity → no spurious re-render
        }
        cache = {
            accounts,
            activeAccountId,
            activeAccount: accounts.find((a) => a.isActive) ?? null,
        };
        return cache;
    };

    return {
        subscribe: (onChange) => manager.subscribe(onChange),
        getSnapshot,
    };
}
