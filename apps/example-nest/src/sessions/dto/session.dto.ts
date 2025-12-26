/**
 * Session DTOs
 * 
 * Data Transfer Objects for session management.
 * Using classes with class-validator for:
 * - Input validation
 * - Swagger documentation
 * - Type safety
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Individual session response
 * Represents a single active session with device info
 */
export class SessionResponseDto {
    @ApiProperty({
        description: 'Unique session identifier',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiPropertyOptional({
        description: 'Human-readable device name',
        example: 'MacBook Pro',
    })
    deviceName?: string;

    @ApiPropertyOptional({
        description: 'Full user agent string',
        example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
    })
    userAgent?: string;

    @ApiPropertyOptional({
        description: 'IP address of the session',
        example: '192.168.1.1',
    })
    ipAddress?: string;

    @ApiProperty({
        description: 'Last activity timestamp',
        example: '2024-01-15T10:30:00Z',
    })
    lastActiveAt: Date;

    @ApiProperty({
        description: 'Session creation timestamp',
        example: '2024-01-15T09:00:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Session expiration timestamp',
        example: '2024-01-22T09:00:00Z',
    })
    expiresAt: Date;

    @ApiProperty({
        description: 'Whether this is the current session',
        example: true,
    })
    isCurrent: boolean;

    @ApiPropertyOptional({
        description: 'Detected browser name',
        example: 'Chrome',
    })
    browser?: string;

    @ApiPropertyOptional({
        description: 'Detected operating system',
        example: 'macOS',
    })
    os?: string;
}

/**
 * Session list response
 * Wraps session array with count
 */
export class SessionListResponseDto {
    @ApiProperty({
        description: 'List of active sessions',
        type: [SessionResponseDto],
    })
    sessions: SessionResponseDto[];

    @ApiProperty({
        description: 'Total number of active sessions',
        example: 3,
    })
    count: number;
}

/**
 * Revoke session response
 * Confirmation after session revocation
 */
export class RevokeSessionResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'Session revoked successfully',
    })
    message: string;

    @ApiPropertyOptional({
        description: 'ID of the revoked session (for single revoke)',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    sessionId?: string;

    @ApiPropertyOptional({
        description: 'Number of sessions revoked (for bulk revoke)',
        example: 4,
    })
    revokedCount?: number;
}
