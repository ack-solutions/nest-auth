/**
 * Profile Controller
 * 
 * REST API endpoints for user profile management.
 * Thin controller pattern - delegates to ProfileService.
 * 
 * Endpoints:
 * - GET   /profile - Get current user profile
 * - PATCH /profile - Update current user profile
 */

import {
    Controller,
    Get,
    Patch,
    Body,
    UseGuards,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { NestAuthAuthGuard, RequestContext } from '@ackplus/nest-auth';
import { ProfileService } from './profile.service';
import {
    ProfileResponseDto,
    UpdateProfileDto,
    UpdateProfileResponseDto,
} from './dto/profile.dto';

/**
 * Profile Controller
 * 
 * Manages user profile viewing and updates.
 * All endpoints require authentication.
 */
@ApiTags('profile')
@ApiBearerAuth('access-token')
@Controller('profile')
@UseGuards(NestAuthAuthGuard)
export class ProfileController {
    constructor(private readonly profileService: ProfileService) { }

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
     * Get current user profile
     * 
     * WHY THIS EXISTS:
     * While /auth/me returns basic user info from the JWT,
     * this endpoint returns complete profile data fresh from
     * the database, including computed fields.
     * 
     * USE CASES:
     * - Profile page display
     * - Settings page pre-fill
     * - Fresh data after updates
     */
    @Get()
    @ApiOperation({
        summary: 'Get current user profile',
        description: 'Returns complete profile information for the authenticated user.',
    })
    @ApiResponse({
        status: 200,
        description: 'User profile',
        type: ProfileResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getProfile(): Promise<ProfileResponseDto> {
        const user = this.getCurrentUserOrThrow();
        return this.profileService.getProfile(user.id);
    }

    /**
     * Update current user profile
     * 
     * WHY THIS EXISTS:
     * Allows users to update their non-sensitive profile information.
     * Uses PATCH semantics - only provided fields are updated.
     * 
     * SECURITY NOTES:
     * - Email changes require verification (separate flow)
     * - Password changes use /auth/change-password
     * - Roles/permissions are admin-only
     * 
     * WHAT CAN BE UPDATED:
     * - firstName, lastName
     * - displayName (username)
     * - avatarUrl
     * - phone
     */
    @Patch()
    @ApiOperation({
        summary: 'Update current user profile',
        description: 'Updates profile information. Only provided fields will be changed.',
    })
    @ApiResponse({
        status: 200,
        description: 'Profile updated successfully',
        type: UpdateProfileResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Validation error' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async updateProfile(
        @Body() dto: UpdateProfileDto,
    ): Promise<UpdateProfileResponseDto> {
        const user = this.getCurrentUserOrThrow();
        return this.profileService.updateProfile(user.id, dto);
    }
}
