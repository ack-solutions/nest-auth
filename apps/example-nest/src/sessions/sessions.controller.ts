/**
 * Sessions Controller
 * 
 * REST API endpoints for session management.
 * Follows thin-controller pattern - delegates to SessionsService.
 * 
 * All endpoints require authentication via NestAuthAuthGuard.
 * 
 * Endpoints:
 * - GET    /sessions     - List all active sessions
 * - DELETE /sessions/:id - Revoke specific session
 * - DELETE /sessions     - Revoke all sessions
 * - DELETE /sessions/others - Revoke all except current
 */

import {
    Controller,
    Get,
    Delete,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { NestAuthAuthGuard } from '@ackplus/nest-auth';
import { RequestContext } from '@ackplus/nest-auth';
import { SessionsService } from './sessions.service';
import {
    SessionListResponseDto,
    RevokeSessionResponseDto,
} from './dto/session.dto';

/**
 * Sessions Controller
 * 
 * Provides session management capabilities:
 * - View all active sessions across devices
 * - Revoke individual sessions (remote logout)
 * - Revoke all sessions (security logout)
 */
@ApiTags('sessions')
@ApiBearerAuth('access-token')
@Controller('sessions')
@UseGuards(NestAuthAuthGuard)
export class SessionsController {
    constructor(private readonly sessionsService: SessionsService) { }

    /**
     * Helper method to get current user or throw
     */
    private getCurrentUserOrThrow() {
        const user = RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    /**
     * Helper method to get current session or throw
     */
    private getCurrentSessionOrThrow() {
        const session = RequestContext.currentSession();
        if (!session) {
            throw new UnauthorizedException('Session not found');
        }
        return session;
    }

    /**
     * List all active sessions
     * 
     * WHY THIS EXISTS:
     * Users need visibility into where their account is logged in.
     * This is essential for security awareness and enables users to
     * detect unauthorized access.
     * 
     * RETURNS:
     * - List of sessions with device info
     * - Current session marked for UI differentiation
     * - Sorted by activity (current first, then most recent)
     */
    @Get()
    @ApiOperation({
        summary: 'List active sessions',
        description: 'Returns all active sessions for the current user with device and activity information.',
    })
    @ApiResponse({
        status: 200,
        description: 'List of active sessions',
        type: SessionListResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    async getSessions(): Promise<SessionListResponseDto> {
        const user = this.getCurrentUserOrThrow();
        const session = this.getCurrentSessionOrThrow();

        return this.sessionsService.getUserSessions(user.id, session.id);
    }

    /**
     * Revoke a specific session
     * 
     * WHY THIS EXISTS:
     * Allows users to remotely logout a specific device.
     * Common use cases:
     * - Lost/stolen device
     * - Logged in on public computer
     * - Shared device access revocation
     * 
     * SECURITY:
     * - Cannot revoke current session (use logout instead)
     * - Only owner can revoke their sessions
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Revoke a specific session',
        description: 'Revokes (logs out) a specific session. Cannot revoke the current session.',
    })
    @ApiParam({
        name: 'id',
        description: 'Session ID to revoke',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @ApiResponse({
        status: 200,
        description: 'Session revoked successfully',
        type: RevokeSessionResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 403, description: 'Cannot revoke current session' })
    @ApiResponse({ status: 404, description: 'Session not found' })
    async revokeSession(@Param('id') sessionId: string): Promise<RevokeSessionResponseDto> {
        const user = this.getCurrentUserOrThrow();
        const currentSession = this.getCurrentSessionOrThrow();

        return this.sessionsService.revokeSession(
            sessionId,
            user.id,
            currentSession.id,
        );
    }

    /**
     * Revoke all sessions except current
     * 
     * WHY THIS EXISTS:
     * Security feature for when user suspects account compromise
     * but wants to continue using their current device.
     * 
     * Similar to "Sign out of all other sessions" in Google/Facebook.
     */
    @Delete('others')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Revoke all other sessions',
        description: 'Revokes all sessions except the current one. User stays logged in on current device.',
    })
    @ApiResponse({
        status: 200,
        description: 'Other sessions revoked',
        type: RevokeSessionResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    async revokeOtherSessions(): Promise<RevokeSessionResponseDto> {
        const user = this.getCurrentUserOrThrow();
        const currentSession = this.getCurrentSessionOrThrow();

        return this.sessionsService.revokeAllOtherSessions(
            user.id,
            currentSession.id,
        );
    }

    /**
     * Revoke ALL sessions including current (logout everywhere)
     * 
     * WHY THIS EXISTS:
     * Nuclear option for complete account security reset.
     * Use cases:
     * - Password was compromised
     * - Account breach suspected
     * - Before deleting account
     * 
     * NOTE: This will log out the current session too.
     * Frontend should redirect to login after calling this.
     */
    @Delete()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Revoke all sessions (logout everywhere)',
        description: 'Revokes all sessions including the current one. User will be logged out completely.',
    })
    @ApiResponse({
        status: 200,
        description: 'All sessions revoked',
        type: RevokeSessionResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    async revokeAllSessions(): Promise<RevokeSessionResponseDto> {
        const user = this.getCurrentUserOrThrow();

        return this.sessionsService.revokeAllSessions(user.id);
    }
}
