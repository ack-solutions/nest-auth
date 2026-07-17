"use client";

/**
 * AccountSwitcherProvider — React binding for multi-account login + switching.
 *
 * Wraps an {@link AccountManager} and exposes the account list, the active
 * account, and add/switch/remove actions. Reactivity is via
 * `useSyncExternalStore` over the manager's `subscribe()`, so switching an
 * account (a pure client-side repoint) re-renders consumers with no server call.
 *
 * @example
 * ```tsx
 * <AccountSwitcherProvider config={{ baseUrl, accessTokenType: 'header' }}>
 *   <App />
 * </AccountSwitcherProvider>
 *
 * function Switcher() {
 *   const { accounts, activeAccount, switchAccount, addAccount } = useAccountSwitcher();
 *   return (
 *     <ul>
 *       {accounts.map((a) => (
 *         <li key={a.accountId} onClick={() => switchAccount(a.accountId)}>
 *           {a.label ?? a.email} {a.isActive ? '(active)' : ''}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
    AccountManager,
    CookieAccountManager,
    type AccountManagerConfig,
    type IAccountSwitcher,
} from '@ackplus/nest-auth-client';
import { AccountSwitcherContext, type AccountSwitcherContextValue } from './account-switcher-context';
import { createAccountSwitcherStore } from './account-switcher-store';

export interface AccountSwitcherProviderProps {
    /** A pre-built manager (AccountManager for header mode, CookieAccountManager for cookie mode). Provide this OR `config`. */
    manager?: IAccountSwitcher;
    /**
     * Config to build a manager once. The right manager is chosen by
     * `accessTokenType`: `'cookie'` → CookieAccountManager, otherwise
     * AccountManager (header). Provide this OR `manager`.
     */
    config?: AccountManagerConfig;
    children: React.ReactNode;
}

export function AccountSwitcherProvider({ manager: managerProp, config, children }: AccountSwitcherProviderProps) {
    // Resolve a stable manager instance for the lifetime of the provider.
    const managerRef = useRef<IAccountSwitcher | null>(null);
    if (!managerRef.current) {
        if (managerProp) {
            managerRef.current = managerProp;
        } else if (config) {
            managerRef.current =
                config.accessTokenType === 'cookie'
                    ? new CookieAccountManager(config)
                    : new AccountManager(config);
        } else {
            throw new Error('AccountSwitcherProvider requires either a `manager` or a `config` prop.');
        }
    }
    const manager = managerRef.current;

    // Load persisted/remote account state once (header: index restore; cookie: GET /accounts).
    useEffect(() => {
        void manager.ready();
    }, [manager]);

    const store = useMemo(() => createAccountSwitcherStore(manager), [manager]);
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

    const value = useMemo<AccountSwitcherContextValue>(
        () => ({
            manager,
            accounts: snapshot.accounts,
            activeAccountId: snapshot.activeAccountId,
            activeAccount: snapshot.activeAccount,
            addAccount: (dto, options) => manager.addAccount(dto, options),
            completeMfa: async (error, verifyDto, options) => {
                await error.client.verify2fa(verifyDto);
                return manager.commitAccount(error.client, options?.meta);
            },
            switchAccount: (accountId) => manager.switchAccount(accountId),
            removeAccount: (accountId) => manager.removeAccount(accountId),
            reset: () => manager.reset(),
            setAccountMeta: (accountId, meta) => manager.setAccountMeta(accountId, meta),
        }),
        [manager, snapshot],
    );

    return <AccountSwitcherContext.Provider value={value}>{children}</AccountSwitcherContext.Provider>;
}
