"use client";

/**
 * Context for the multi-account switcher. Deliberately SEPARATE from AuthContext
 * so the single-account AuthProvider stays untouched — an app can use the
 * switcher on its own, or render a nested AuthProvider for the active account.
 */
import { createContext } from 'react';
import type {
    IAccountSwitcher,
    AccountSnapshot,
    AccountMeta,
    AddAccountOptions,
    AccountMfaRequiredError,
    ILoginRequest,
    IVerify2faRequest,
} from '@ackplus/nest-auth-client';

export interface AccountSwitcherContextValue {
    /** The underlying manager (escape hatch for advanced flows). */
    manager: IAccountSwitcher;
    /** All logged-in accounts. */
    accounts: AccountSnapshot[];
    /** The active account id, or null when none. */
    activeAccountId: string | null;
    /** The active account snapshot, or null. */
    activeAccount: AccountSnapshot | null;
    /**
     * Log into a NEW account without disturbing the others, and make it active.
     * Pass `{ meta: { tenantName, label } }` to name the account in the switcher.
     * Throws `AccountMfaRequiredError` when the login needs MFA — catch it and
     * call {@link completeMfa}.
     */
    addAccount: (dto: ILoginRequest, options?: AddAccountOptions) => Promise<AccountSnapshot>;
    /**
     * Finish an MFA-gated `addAccount`: verifies the challenge on the pending
     * client (from the caught {@link AccountMfaRequiredError}) and registers it.
     *
     * `verify2fa` is single-shot — it consumes the code. If verification succeeds
     * but the subsequent commit throws, do NOT call `completeMfa` again (the code
     * is spent); recover by calling `manager.commitAccount(error.client, meta)`
     * directly.
     */
    completeMfa: (
        error: AccountMfaRequiredError,
        verifyDto: IVerify2faRequest,
        options?: AddAccountOptions,
    ) => Promise<AccountSnapshot>;
    /** Repoint the active account (pure client-side — no server call). */
    switchAccount: (accountId: string) => Promise<AccountSnapshot>;
    /** Remove one account (revokes its session server-side, best-effort). */
    removeAccount: (accountId: string) => Promise<void>;
    /** Remove every account and wipe their storage (e.g. to start a fresh single-account session). */
    reset: () => Promise<void>;
    /** Update an account's display metadata (label / tenantName) for the switcher UI. */
    setAccountMeta: (accountId: string, meta: AccountMeta) => Promise<AccountSnapshot>;
}

export const AccountSwitcherContext = createContext<AccountSwitcherContextValue | null>(null);
AccountSwitcherContext.displayName = 'AccountSwitcherContext';
