import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IAuthSuccessResponse } from '@libs/auth-types';

/**
 * Auth Success Response DTO
 *
 * Used when `accessTokenType: 'cookie'` - tokens are set in HTTP-only cookies.
 *
 * Response Format:
 * - Contains `message` and optionally `isRequiresMfa`
 * - Does NOT contain `accessToken` or `refreshToken` (they're in cookies)
 *
 * Endpoints:
 * - Login/Signup/Refresh: Returns `message` and `isRequiresMfa`
 * - Verify 2FA: Returns only `message`
 *
 * Note: When using header mode (`accessTokenType: 'header'`),
 * the response includes tokens AND message (see AuthResponseDto).
 *
 * @example Cookie Mode - Login Response
 * ```json
 * {
 *   "message": "Login successful",
 *   "isRequiresMfa": false
 * }
 * ```
 * Tokens are in Set-Cookie headers, not in response body.
 *
 * @example Header Mode - Login Response
 * ```json
 * {
 *   "message": "Login successful",
 *   "accessToken": "eyJhbGc...",
 *   "refreshToken": "eyJhbGc...",
 *   "isRequiresMfa": false
 * }
 * ```
 * Tokens are in response body.
 */
export class AuthSuccessResponseDto implements IAuthSuccessResponse {
    @ApiProperty({
        description: 'Success message indicating the operation result',
        example: 'Authentication successful',
        examples: [
            'Signup successful',
            'Login successful',
            'Token refreshed successfully',
            '2FA verification successful'
        ]
    })
    message: string;

    @ApiPropertyOptional({
        description: 'Whether multi-factor authentication is required (only for login/signup/refresh)',
        example: false,
        required: false
    })
    isRequiresMfa?: boolean;
}
