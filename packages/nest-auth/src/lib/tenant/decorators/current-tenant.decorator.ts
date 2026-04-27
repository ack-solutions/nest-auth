import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Returns the active tenant id for the current request, or `null`.
 *
 * The value is `null` in any of the following cases — handlers MUST be
 * prepared to handle `null` rather than assuming a string:
 *
 * - `tenant.enabled = false` (single-tenant deployment) — no tenantId is
 *   ever populated on the request.
 * - Public route (`@Auth(true)` or no guard) where the request was not
 *   authenticated.
 * - SHARED / ISOLATED mode but the user has no active tenant context yet
 *   (e.g. immediately after signup with `tenantId` omitted).
 *
 * The return type is intentionally `string | null` so TypeScript will
 * complain at compile time if a handler treats it as a non-null `string`.
 *
 * @example
 * ```ts
 * @Auth()
 * @Get()
 * list(@CurrentTenantId() tenantId: string | null) {
 *   if (!tenantId) {
 *     // single-tenant or no-context fallback
 *     return this.service.listGlobal();
 *   }
 *   return this.service.listForTenant(tenantId);
 * }
 * ```
 */
export const CurrentTenantId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string | null => {
        const request = ctx.switchToHttp().getRequest();
        return request.tenantId ?? null;
    }
);

/**
 * Alias for {@link CurrentTenantId}.
 *
 * @deprecated Use {@link CurrentTenantId} instead. Will be removed in v3.
 */
export const CurrentTenant = CurrentTenantId;
