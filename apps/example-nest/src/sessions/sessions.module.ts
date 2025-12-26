/**
 * Sessions Module
 * 
 * Handles session management functionality:
 * - List active sessions for current user
 * - Revoke specific sessions
 * - Revoke all sessions (logout everywhere)
 * 
 * This module demonstrates how to extend nest-auth with
 * custom session management features.
 */

import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

/**
 * SessionsModule provides user-facing session management endpoints.
 * 
 * Note: We provide Reflector here to ensure the NestAuthAuthGuard
 * can be properly instantiated when used in controllers.
 * NestAuthModule (global) provides the guard itself and its other dependencies.
 */
@Module({
    imports: [],
    controllers: [SessionsController],
    providers: [
        Reflector,
        SessionsService,
    ],
    exports: [SessionsService],
})
export class SessionsModule { }
