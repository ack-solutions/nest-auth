import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiResponse } from '@nestjs/swagger';

/**
 * Canonical error envelope returned by the package's exception filter:
 * `{ statusCode, error, message, code }`. The machine-readable `code` is what
 * clients branch on.
 */
export class ApiErrorResponseDto {
    @ApiProperty({ example: 401, description: 'HTTP status code' })
    statusCode: number;

    @ApiProperty({ example: 'Unauthorized', description: 'HTTP status text / exception name' })
    error: string;

    @ApiProperty({ example: 'Invalid credentials', description: 'Human-readable message' })
    message: string;

    @ApiProperty({
        example: 'INVALID_CREDENTIALS',
        description: 'Stable, machine-readable error code — branch on this, not the message',
    })
    code: string;
}

/** 400 — request body/params failed validation or a business rule. */
export const ApiValidationError = (description = 'Validation failed (bad input).') =>
    ApiResponse({ status: 400, description, type: ApiErrorResponseDto });

/** 401 — missing/invalid/expired token or bad credentials. */
export const ApiUnauthorized = (description = 'Missing, invalid, or expired authentication.') =>
    ApiResponse({ status: 401, description, type: ApiErrorResponseDto });

/** 403 — authenticated, but not allowed (role/permission/guard mismatch). */
export const ApiForbidden = (description = 'Authenticated but not permitted.') =>
    ApiResponse({ status: 403, description, type: ApiErrorResponseDto });

/** 404 — the referenced resource does not exist. */
export const ApiNotFoundError = (description = 'Resource not found.') =>
    ApiResponse({ status: 404, description, type: ApiErrorResponseDto });

/** 409 — conflict (e.g. email/phone already in use). */
export const ApiConflictError = (description = 'Conflict — resource already exists.') =>
    ApiResponse({ status: 409, description, type: ApiErrorResponseDto });

/** 429 — rate-limited / locked out. */
export const ApiTooManyRequests = (description = 'Too many attempts — rate limited / locked out.') =>
    ApiResponse({ status: 429, description, type: ApiErrorResponseDto });

/** Validation + auth — the common pair for an authenticated, body-taking route. */
export const ApiStandardErrors = () => applyDecorators(ApiValidationError(), ApiUnauthorized());

/** Auth + forbidden — for guarded routes that can also be role/permission-denied. */
export const ApiAuthErrors = () => applyDecorators(ApiUnauthorized(), ApiForbidden());
