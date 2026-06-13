import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JWTTokenPayload } from '../interfaces/token-payload.interface';

/**
 * `@CurrentUser()` — parameter decorator that returns the authenticated principal
 * from `request.user`, as populated by {@link NestAuthAuthGuard}.
 *
 * What `request.user` holds depends on how the request authenticated:
 * - **JWT / cookie auth** → the verified access-token payload (`JWTTokenPayload`:
 *   `sub`/`id`, `email`, `roles`, `sessionId`, `tenantId`, …).
 * - **API-key auth** → the resolved `NestAuthUser` entity.
 * - **Unauthenticated** (e.g. an `@Public()` route, or `@Auth(true)` with no token)
 *   → `null`.
 *
 * Pass a key to project a single field:
 * `@CurrentUser('sub') userId: string`.
 *
 * For the tenant-scoped membership (with roles) use `@CurrentUserAccess()` instead.
 *
 * @example
 * ```typescript
 * @Get('me')
 * whoami(@CurrentUser() user: JWTTokenPayload) {
 *   return user;
 * }
 *
 * @Get('my-id')
 * myId(@CurrentUser('sub') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
    (data: keyof JWTTokenPayload | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user ?? null;

        if (data && user) {
            return user[data];
        }

        return user;
    },
);
