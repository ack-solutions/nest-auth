import type { INestAuthUserAccess } from '@ackplus/nest-auth-client';

/**
 * Unique tenant ids from memberships (nested tenant or access-level tenantId).
 */
export function distinctTenantIdsFromUserAccesses(
    accesses: INestAuthUserAccess[] | undefined,
): string[] {
    const ids = new Set<string>();
    for (const access of accesses ?? []) {
        const id = access?.tenant?.id ?? access?.tenantId;
        if (id) ids.add(id);
    }
    return [...ids];
}

/** True when the user belongs to more than one tenant and must pick a workspace. */
export function needsTenantSelectionFromUserAccesses(
    accesses: INestAuthUserAccess[] | undefined,
): boolean {
    return distinctTenantIdsFromUserAccesses(accesses).length > 1;
}
