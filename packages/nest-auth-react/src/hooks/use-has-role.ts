"use client";

/**
 * Role and permission hooks
 */

import { useContext, useMemo } from 'react';
import { hasRole, hasPermission } from '@ackplus/nest-auth-client';
import { AuthContext } from '../context/auth-context';

/**
 * Check if current user has a specific role
 * 
 * @param role - Role name or array of role names
 * @param matchAll - If true, user must have ALL roles
 * @returns true if user has the required role(s)
 * 
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const isAdmin = useHasRole('admin');
 * 
 *   if (!isAdmin) {
 *     return <div>Access denied</div>;
 *   }
 * 
 *   return <AdminContent />;
 * }
 * ```
 */
export function useHasRole(role: string | string[], matchAll: boolean = false): boolean {
    const context = useContext(AuthContext);

    return useMemo(() => {
        return hasRole(context.user, role, matchAll);
    }, [context.user, role, matchAll]);
}

/**
 * Check if current user has a specific permission
 * 
 * @param permission - Permission name or array of permission names
 * @param matchAll - If true, user must have ALL permissions
 * @returns true if user has the required permission(s)
 * 
 * @example
 * ```tsx
 * function OrdersPage() {
 *   const canRead = useHasPermission('orders.read');
 *   const canWrite = useHasPermission('orders.write');
 * 
 *   if (!canRead) {
 *     return <div>Access denied</div>;
 *   }
 * 
 *   return (
 *     <div>
 *       <OrdersList />
 *       {canWrite && <CreateOrderButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useHasPermission(permission: string | string[], matchAll: boolean = false): boolean {
    const context = useContext(AuthContext);

    return useMemo(() => {
        return hasPermission(context.user, permission, matchAll);
    }, [context.user, permission, matchAll]);
}
