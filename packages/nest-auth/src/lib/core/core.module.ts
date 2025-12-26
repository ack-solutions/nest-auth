import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthProviderRegistryService } from './services/auth-provider-registry.service';
import { AppleAuthProvider } from './providers/apple-auth.provider';
import { JwtAuthProvider } from './providers/jwt-auth.provider';
import { EmailAuthProvider } from './providers/email-auth.provider';
import { FacebookAuthProvider } from './providers/facebook-auth.provider';
import { GoogleAuthProvider } from './providers/google-auth.provider';
import { GitHubAuthProvider } from './providers/github-auth.provider';
import { PhoneAuthProvider } from './providers/phone-auth.provider';
import { JwtService } from './services/jwt.service';
import { AuthConfigService } from './services/auth-config.service';
import { InitializationService } from './services/initialization.service';
import { DebugLoggerService } from './services/debug-logger.service';
import { TenantModule } from '../tenant/tenant.module';
import { NestAuthUser } from '../user/entities/user.entity';
import { NestAuthIdentity } from '../user/entities/identity.entity';

/**
 * CoreModule provides core authentication services and providers.
 * Imports TypeOrmModule.forFeature to provide DataSource for auth providers.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([NestAuthUser, NestAuthIdentity]),
        TenantModule
    ],
    providers: [
        Reflector,
        AuthConfigService,
        DebugLoggerService,
        JwtService,
        AuthProviderRegistryService,
        EmailAuthProvider,
        PhoneAuthProvider,
        JwtAuthProvider,
        GoogleAuthProvider,
        FacebookAuthProvider,
        AppleAuthProvider,
        GitHubAuthProvider,
        InitializationService,
    ],
    exports: [
        Reflector,
        JwtService,
        AuthProviderRegistryService,
        AuthConfigService,
        DebugLoggerService,
        InitializationService,
    ],
})
export class CoreModule { }
