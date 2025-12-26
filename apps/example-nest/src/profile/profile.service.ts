/**
 * Profile Service
 * 
 * Business logic for user profile operations.
 * Uses NestAuthUser entity directly for database operations.
 * 
 * NOTE: NestAuthUser uses a `metadata` JSON field for extensible profile data.
 * firstName, lastName, displayName, avatarUrl are stored in metadata.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { NestAuthUser } from '@ackplus/nest-auth';
import { ProfileResponseDto, UpdateProfileDto, UpdateProfileResponseDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
    /**
     * Get user profile by ID
     * 
     * Retrieves full profile information including MFA status.
     * The JWT contains basic user info, but this fetches fresh data.
     * 
     * @param userId - User ID to fetch profile for
     * @returns Complete profile response
     */
    async getProfile(userId: string): Promise<ProfileResponseDto> {
        // Fetch user from database for fresh data
        const user = await NestAuthUser.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException({
                message: 'User not found',
                code: 'USER_NOT_FOUND',
            });
        }

        return this.toProfileResponse(user);
    }

    /**
     * Update user profile
     * 
     * Updates allowed profile fields. Uses metadata field for extensible profile data.
     * Some fields cannot be updated through this endpoint for security:
     * - Email (requires verification flow)
     * - Password (requires dedicated change-password endpoint)
     * - Roles/permissions (admin only)
     * 
     * @param userId - User ID to update
     * @param dto - Update data
     * @returns Success message with updated profile
     */
    async updateProfile(
        userId: string,
        dto: UpdateProfileDto,
    ): Promise<UpdateProfileResponseDto> {
        // Fetch current user
        const user = await NestAuthUser.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException({
                message: 'User not found',
                code: 'USER_NOT_FOUND',
            });
        }

        // Initialize metadata if not exists
        if (!user.metadata) {
            user.metadata = {};
        }

        // Update allowed fields in metadata
        if (dto.firstName !== undefined) {
            user.metadata.firstName = dto.firstName;
        }
        if (dto.lastName !== undefined) {
            user.metadata.lastName = dto.lastName;
        }
        if (dto.displayName !== undefined) {
            user.metadata.displayName = dto.displayName;
        }
        if (dto.avatarUrl !== undefined) {
            user.metadata.avatarUrl = dto.avatarUrl;
        }
        // Phone is a direct field on the user entity
        if (dto.phone !== undefined) {
            user.phone = dto.phone;
        }

        // Save changes
        await user.save();

        return {
            message: 'Profile updated successfully',
            profile: this.toProfileResponse(user),
        };
    }

    /**
     * Transform user entity to profile response DTO
     * 
     * Centralizes the mapping logic and ensures consistent response shape.
     * Excludes sensitive fields like password hash.
     * Extracts profile fields from metadata JSON.
     */
    private toProfileResponse(user: NestAuthUser): ProfileResponseDto {
        const metadata = user.metadata || {};

        return {
            id: user.id,
            email: user.email,
            firstName: metadata.firstName,
            lastName: metadata.lastName,
            fullName: this.getFullName(metadata),
            displayName: metadata.displayName,
            avatarUrl: metadata.avatarUrl,
            phone: user.phone,
            isVerified: user.isVerified,
            isMfaEnabled: user.isMfaEnabled,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    /**
     * Compute full name from metadata
     */
    private getFullName(metadata: Record<string, any>): string | undefined {
        const parts = [metadata.firstName, metadata.lastName].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : undefined;
    }
}
