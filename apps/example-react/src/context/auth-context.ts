import { createContext } from 'react';
import type { ISessionUserData } from '@ackplus/nest-auth-client';
import type { AuthContextValue } from '@ackplus/nest-auth-react';

/**
 * Example app auth surface: everything from {@link useNestAuth} plus optional profile refresh helpers.
 */
export interface AppAuthContextValue extends AuthContextValue {
    /** False while the Nest auth client is still resolving the initial session. */
    isUserResolved: boolean;
    /** Re-fetch the current user from the API (`verifySession`). */
    refetchUser: () => Promise<ISessionUserData | null>;
    /** Alias for {@link AuthContextValue.sessionData} for ergonomic destructuring in app code. */
    user: ISessionUserData | null;
}

export const AppAuthContext = createContext<AppAuthContextValue | null>(null);
