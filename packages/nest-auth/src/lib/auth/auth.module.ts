import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { MfaService } from './services/mfa.service';
import { NestAuthAuthGuard } from './guards/auth.guard';
import { TokenResponseInterceptor } from './interceptors/token-response.interceptor';
import { AuthController } from './controllers/auth.controller';
import { MfaController } from './controllers/mfa.controller';
import { AuthSessionEventListener } from './services/auth-session-event-listener.service';
import { NestAuthIdentity } from '../user/entities/identity.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NestAuthUser } from '../user/entities/user.entity';
import { PasswordService } from './services/password.service';
import { VerificationService } from './services/verification.service';
import { OtpFlowService } from './services/otp-flow.service';
import { LogoutService } from './services/logout.service';
import { SessionTokenService } from './services/session-token.service';
import { InviteService } from './services/invite.service';
import { NestAuthOTP } from './entities/otp.entity';
import { NestAuthMFASecret } from './entities/mfa-secret.entity';
import { NestAuthBlockedEmailDomain } from './entities/blocked-email-domain.entity';
import { DisposableEmailService } from './services/disposable-email.service';
import { NestAuthAccessKey } from '../user/entities/access-key.entity';
import { NestAuthTrustedDevice } from './entities/trusted-device.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserModule } from '../user/user.module';
import { CoreModule } from '../core/core.module';
import { SessionModule } from '../session/session.module';
import { TenantModule } from '../tenant/tenant.module';
import { RoleModule } from '../role/role.module';
import { PermissionModule } from '../permission';

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
            NestAuthBlockedEmailDomain,
        ]),
        forwardRef(() => CoreModule),
        forwardRef(() => UserModule),
        forwardRef(() => SessionModule),
        forwardRef(() => TenantModule),
        forwardRef(() => RoleModule),
        forwardRef(() => PermissionModule),
    ],
    providers: [
        AuthService,
        MfaService,
        NestAuthAuthGuard,
        TokenResponseInterceptor,
        AuthSessionEventListener,
        PasswordService,
        VerificationService,
        OtpFlowService,
        LogoutService,
        SessionTokenService,
        InviteService,
        DisposableEmailService,
    ],
    controllers: [AuthController, MfaController],
    exports: [
        AuthService,
        PasswordService,
        VerificationService,
        OtpFlowService,
        LogoutService,
        SessionTokenService,
        InviteService,
        MfaService,
        NestAuthAuthGuard,
        TokenResponseInterceptor,
        DisposableEmailService,
    ],
})
export class AuthModule {
}
