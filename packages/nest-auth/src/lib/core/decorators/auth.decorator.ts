import { UseGuards, applyDecorators, SetMetadata } from '@nestjs/common';
import { NestAuthAuthGuard, OPTIONAL_AUTH_KEY } from '../../auth/guards/auth.guard';

/**
 * Flexible Authentication Decorator
 *
 * This decorator applies the NestAuthAuthGuard with configurable authentication mode:
 *
 * @param optional - If true, authentication becomes optional (no errors thrown for missing/invalid tokens)
 *
 * @example Required Authentication (default behavior):
 * ```typescript
 * @Get('protected')
 * @Auth() // or @Auth(false)
 * async getProtectedData(@Request() req) {
 *   const user = req.user; // Will always exist or request fails
 *   return this.getProtectedData(user.id);
 * }
 * ```
 *
 * @example Optional Authentication:
 * ```typescript
 * @Get('posts')
 * @Auth(true) // Optional authentication
 * async getPosts(@Request() req) {
 *   const user = req.user; // Will be null if not authenticated
 *   if (user) {
 *     return this.getPersonalizedPosts(user.id);
 *   } else {
 *     return this.getPublicPosts();
 *   }
 * }
 * ```
 */
export const Auth = (optional: boolean = false) => applyDecorators(
    SetMetadata(OPTIONAL_AUTH_KEY, optional),
    UseGuards(NestAuthAuthGuard)
);
