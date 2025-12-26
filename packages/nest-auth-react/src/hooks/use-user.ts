/**
 * useUser hook - User data only
 */

import { useContext } from 'react';
import { IAuthUser } from '@ackplus/nest-auth-client';
import { AuthContext } from '../context/auth-context';

/**
 * Access the current user
 * 
 * @returns Current user or null
 * 
 * @example
 * ```tsx
 * function UserProfile() {
 *   const user = useUser();
 * 
 *   if (!user) {
 *     return <div>Not logged in</div>;
 *   }
 * 
 *   return (
 *     <div>
 *       <h1>Welcome, {user.email}</h1>
 *       <p>Verified: {user.isVerified ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUser(): IAuthUser | null {
    const context = useContext(AuthContext);
    return context.user;
}
