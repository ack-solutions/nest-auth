/**
 * Profile Module
 * 
 * Handles user profile management:
 * - View profile information
 * - Update profile details
 * 
 * Separated from auth module for clean domain boundaries.
 */

import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
/**
 * ProfileModule provides user profile management endpoints.
 */
@Module({
    controllers: [ProfileController],
    providers: [
        ProfileService,
    ],
    exports: [ProfileService],
})
export class ProfileModule { }
