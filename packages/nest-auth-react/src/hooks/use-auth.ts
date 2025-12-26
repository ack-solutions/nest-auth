/**
 * useNestAuth hook - Full auth context access
 */

import { useContext } from 'react';
import { AuthContext, AuthContextValue } from '../context/auth-context';

/**
 * Access the full auth context
 * 
 * @returns Full auth context with status, user, session, error, and all actions
 * 
 * @example
 * ```tsx
 * function LoginButton() {
 *   const { user, login, logout, isLoading, isAuthenticated } = useNestAuth();
 * 
 *   if (isLoading) return <div>Loading...</div>;
 * 
 *   if (isAuthenticated) {
 *     return <button onClick={() => logout()}>Logout ({user.email})</button>;
 *   }
 * 
 *   return (
 *     <button onClick={() => login({ credentials: { email: '...', password: '...' } })}>
 *       Login
 *     </button>
 *   );
 * }
 * ```
 */
export function useNestAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (!context.client) {
        throw new Error('useNestAuth must be used within an AuthProvider');
    }

    return context;
}
