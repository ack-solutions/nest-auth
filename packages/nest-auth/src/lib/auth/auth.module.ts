import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { CookieService } from './services/cookie.service';
import { MfaService } from './services/mfa.service';
import { ClientConfigService } from './services/client-config.service';
import { NestAuthAuthGuard } from './guards/auth.guard';
import { RefreshTokenInterceptor } from './interceptors/refresh-token.interceptor';
import { AuthController } from './controllers/auth.controller';
import { MfaController } from './controllers/mfa.controller';
import { AuthSessionEventListener } from './services/auth-session-event-listener.service';
import { NestAuthIdentity } from '../user/entities/identity.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthUser } from '../user/entities/user.entity';
import { NestAuthOTP } from './entities/otp.entity';
import { NestAuthMFASecret } from './entities/mfa-secret.entity';
import { NestAuthAccessKey } from '../user/entities/access-key.entity';
import { NestAuthTrustedDevice } from './entities/trusted-device.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserModule } from '../user/user.module';
import { CoreModule } from '../core/core.module';
import { SessionModule } from '../session/session.module';
import { TenantModule } from '../tenant/tenant.module';
import { RoleModule } from '../role/role.module';

@Module({
    imports: [
        EventEmitterModule,
        TypeOrmModule.forFeature([
            NestAuthUser,
            NestAuthOTP,
            NestAuthMFASecret,
            NestAuthAccessKey,
            NestAuthIdentity,
            NestAuthTrustedDevice,
        ]),
        forwardRef(() => CoreModule),
        forwardRef(() => UserModule),
        forwardRef(() => SessionModule),
        forwardRef(() => TenantModule),
        forwardRef(() => RoleModule),
    ],
    providers: [
        AuthService,
        CookieService,
        MfaService,
        ClientConfigService,
        NestAuthAuthGuard,
        RefreshTokenInterceptor,
        AuthSessionEventListener,
    ],
    controllers: [AuthController, MfaController],
    exports: [
        AuthService,
        CookieService,
        MfaService,
        ClientConfigService,
        NestAuthAuthGuard,
        RefreshTokenInterceptor,
    ],
})
export class AuthModule {
}
