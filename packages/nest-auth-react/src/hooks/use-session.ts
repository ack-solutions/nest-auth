/**
 * useSession hook - Session data only
 */

import { useContext } from 'react';
import { ClientSession } from '@ackplus/nest-auth-client';
import { AuthContext } from '../context/auth-context';

/**
 * Access the current session
 * 
 * @returns Current session or null
 * 
 * @example
 * ```tsx
 * function SessionInfo() {
 *   const session = useSession();
 * 
 *   if (!session) {
 *     return <div>No active session</div>;
 *   }
 * 
 *   return (
 *     <div>
 *       <p>User ID: {session.userId}</p>
 *       {session.expiresAt && (
 *         <p>Expires: {session.expiresAt.toISOString()}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSession(): ClientSession | null {
    const context = useContext(AuthContext);
    return context.session;
}

