import { SetMetadata } from '@nestjs/common';

/**
 * Key for public route metadata
 * Used to mark routes that should skip authentication when global guard is enabled
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public decorator
 *
 * Use this decorator to skip authentication on specific routes when enableGlobalGuard is true.
 *
 * @example
 * ```typescript
 * @Controller('users')
 * export class UsersController {
 *   // This route is public - no authentication required
 *   @Public()
 *   @Get('info')
 *   getPublicInfo() {
 *     return { info: 'public data' };
 *   }
 *
 *   // This route requires authentication (protected by global guard)
 *   @Get('profile')
 *   getProfile(@Request() req) {
 *     return req.user;
 *   }
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
