"use client";

/**
 * AddAccountGuard — a GuestGuard that ALSO renders its children while an
 * already-authenticated user is adding another account (Gmail-style).
 *
 * A plain {@link GuestGuard} redirects every authenticated user away from the
 * login form — which makes "Add another account" impossible, since the user is
 * authenticated by definition. AddAccountGuard renders the login form when the
 * app is in add-account mode (`adding`), and otherwise behaves exactly like
 * GuestGuard (redirect/fallback when authenticated).
 *
 * Drive `adding` from your own signal — typically a query param the switcher's
 * "Add another account" button sets, e.g. `?add=1`.
 */

import React from 'react';
import { GuestGuard, type GuestGuardProps } from './guest-guard';

export interface AddAccountGuardProps extends Omit<GuestGuardProps, 'allowWhenAddingAccount'> {
    /**
     * Whether the app is currently adding another account (e.g. `?add=1`).
     * When `true`, the login form renders even if a user is already signed in.
     * Default `true` (a dedicated add-account route always shows the form).
     */
    adding?: boolean;
}

/**
 * @example
 * ```tsx
 * // Dedicated add-account route — always shows the login form:
 * <AddAccountGuard>
 *   <LoginForm onSuccess={(dto) => addAccount(dto)} />
 * </AddAccountGuard>
 *
 * // Shared login route — only bypass the guard when ?add=1:
 * const adding = new URLSearchParams(location.search).get('add') === '1';
 * <AddAccountGuard adding={adding} onAuthenticated={() => navigate('/dashboard')}>
 *   <LoginForm />
 * </AddAccountGuard>
 * ```
 */
export function AddAccountGuard({ adding = true, ...rest }: AddAccountGuardProps): React.ReactElement | null {
    return <GuestGuard allowWhenAddingAccount={adding} {...rest} />;
}
