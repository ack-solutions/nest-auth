"use client";

/**
 * Hooks for the multi-account switcher. Use within an `<AccountSwitcherProvider>`.
 */
import { useContext } from 'react';
import type { AccountSnapshot } from '@ackplus/nest-auth-client';
import { AccountSwitcherContext, type AccountSwitcherContextValue } from './account-switcher-context';

/** Full switcher API: `accounts`, `activeAccount`, `addAccount`, `switchAccount`, `removeAccount`, `manager`. */
export function useAccountSwitcher(): AccountSwitcherContextValue {
    const ctx = useContext(AccountSwitcherContext);
    if (!ctx) {
        throw new Error('useAccountSwitcher must be used within an <AccountSwitcherProvider>.');
    }
    return ctx;
}

/** Just the list of logged-in accounts (re-renders when it changes). */
export function useAccounts(): AccountSnapshot[] {
    return useAccountSwitcher().accounts;
}

/** Just the active account, or null. */
export function useActiveAccount(): AccountSnapshot | null {
    return useAccountSwitcher().activeAccount;
}
