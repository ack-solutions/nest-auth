"use client";

/**
 * Context for the multi-account switcher. Deliberately SEPARATE from AuthContext
 * so the single-account AuthProvider stays untouched — an app can use the
 * switcher on its own, or render a nested AuthProvider for the active account.
 */
import { createContext } from 'react';
import type {
    AccountManager,
    AccountSnapshot,
    ILoginRequest,
} from '@ackplus/nest-auth-client';

export interface AccountSwitcherContextValue {
    /** The underlying manager (escape hatch for advanced flows, e.g. MFA via commitAccount). */
    manager: AccountManager;
    /** All logged-in accounts. */
    accounts: AccountSnapshot[];
    /** The active account id, or null when none. */
    activeAccountId: string | null;
    /** The active account snapshot, or null. */
    activeAccount: AccountSnapshot | null;
    /** Log into a NEW account without disturbing the others, and make it active. */
    addAccount: (dto: ILoginRequest) => Promise<AccountSnapshot>;
    /** Repoint the active account (pure client-side — no server call). */
    switchAccount: (accountId: string) => Promise<AccountSnapshot>;
    /** Remove one account (revokes its session server-side, best-effort). */
    removeAccount: (accountId: string) => Promise<void>;
}

export const AccountSwitcherContext = createContext<AccountSwitcherContextValue | null>(null);
AccountSwitcherContext.displayName = 'AccountSwitcherContext';
