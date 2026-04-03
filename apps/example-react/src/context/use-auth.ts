'use client';

import { useContext } from 'react';
import { AppAuthContext, type AppAuthContextValue } from './auth-context';

/**
 * Full auth API for the example React app (Nest auth + `refetchUser`).
 */
export function useAuth(): AppAuthContextValue {
    const ctx = useContext(AppAuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AppAuthProvider');
    }
    return ctx;
}
