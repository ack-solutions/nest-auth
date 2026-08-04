import { Controller, Post, Body, UnauthorizedException, UseGuards, HttpCode, Get, Delete, Param, ForbiddenException } from '@nestjs/common';
import { SkipMfa, SkipMustChangePassword, SkipEmailVerification, NestAuthUser, ApiValidationError, ApiUnauthorized, ApiForbidden } from '../../core';
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';
import { MfaService } from '../services/mfa.service';
import { RequestContext } from '../../request-context/request-context';
import { NestAuthSendMfaCodeRequestDto } from '../dto/requests/send-mfa-code.request.dto';
import { NestAuthVerifyTotpSetupRequestDto } from '../dto/requests/verify-totp-setup.request.dto';
import { NestAuthSetupTotpRequestDto } from '../dto/requests/setup-totp.request.dto';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NestAuthAuthGuard } from '../guards/auth.guard';
import { NestAuthToggleMfaRequestDto } from '../dto/requests/toggle-mfa.request.dto';
import { MfaStatusResponseDto, MfaDeviceDto } from '../dto/responses/mfa-status.response.dto';
import { AuthConfigService } from '../../core/services/auth-config.service';
import {
    NestAuthMfaToggleResponseDto,
    NestAuthMfaDeviceRemovedResponseDto,
    NestAuthMfaCodeSentResponseDto,
    NestAuthMfaDeviceVerifiedResponseDto,
    NestAuthMfaResetResponseDto
} from '../dto/responses/auth-messages.response.dto';
import { MFA_ERROR_CODES, ERROR_CODES } from '../../auth.constants';

@ApiTags('MFA')
@ApiBearerAuth('access-token')
@ApiValidationError('Invalid or expired code.') // 400 — all routes
@ApiUnauthorized() //                               401 — all routes
@ApiForbidden() //                                  403 — all routes
@SkipMustChangePassword() // MFA must stay reachable so a 2FA user can finish signing in
@SkipEmailVerification() // ...and so an unverified user can complete MFA login
@Controller('mfa')
export class MfaController {
    constructor(
        private readonly mfaService: MfaService,
        private readonly authConfig: AuthConfigService,
    ) { }

    @ApiOperation({ summary: 'Get MFA status for the current user' })
    @ApiResponse({ status: 200, type: MfaStatusResponseDto })
    @HttpCode(200)
    @Get('status')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async getStatus(): Promise<MfaStatusResponseDto> {
        
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const config = this.mfaService.mfaConfig;
        const globallyEnabled = config?.enabled ?? false;

        let verifiedMethods: NestAuthMFAMethodEnum[] = [];
        let totpDevices: MfaDeviceDto[] = [];
        let hasRecoveryCode = false;
        let isEnabled = false;

        if (globallyEnabled) {
            [verifiedMethods, totpDevices, hasRecoveryCode] = await Promise.all([
                this.mfaService.getVerifiedMethods(user.id),
                this.mfaService.getTotpDevices(user.id),
                this.mfaService.hasRecoveryCode(user.id),
            ]);
            isEnabled = config?.required ? true : await this.mfaService.isMfaEnabled(user.id);
        }

        const required = config?.required ?? false;
        // `allowUserToggle` is a POLICY flag ("may members manage their own 2FA?") —
        // it must come from config, NOT from whether the member already has MFA on.
        // Gating it on the user's state made it impossible to turn MFA ON: a member
        // with MFA off got allowUserToggle/canToggle=false, so a UI honouring the
        // flag disabled the switch forever. Mirror the real gate the toggle endpoint
        // enforces (requireMfaEnabledForApp + canUserToggleMfa).
        const allowUserToggle = globallyEnabled ? (config?.allowUserToggle ?? false) : false;
        const canToggle = globallyEnabled && this.mfaService.canUserToggleMfa();

        return {
            isEnabled,
            verifiedMethods,  // Methods user has verified/can use
            configuredMethods: this.mfaService.getAvailableMethods(),  // Methods configured in app
            allowUserToggle,
            allowMethodSelection: config?.allowMethodSelection ?? false,
            totpDevices,
            hasRecoveryCode,
            required,
            canToggle,
        };
    }

    @ApiOperation({ summary: 'Enable or disable MFA for the current user' })
    @ApiResponse({ status: 200, type: NestAuthMfaToggleResponseDto })
    @HttpCode(200)
    @Post('toggle')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async toggleMfa(@Body() input: NestAuthToggleMfaRequestDto): Promise<NestAuthMfaToggleResponseDto> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        this.mfaService.requireMfaEnabledForApp(true);
        // Check if user can toggle (accounts for required flag)
        if (!this.mfaService.canUserToggleMfa()) {
            throw new ForbiddenException({
                message: 'MFA toggle is not allowed',
                code: ERROR_CODES.MFA_TOGGLING_NOT_ALLOWED,
            });
        }

        if (input.enabled) {
            await this.mfaService.enableMFA(user.id);
            return { message: 'MFA enabled successfully' };
        }

        await this.mfaService.disableMFA(user.id);
        return { message: 'MFA disabled successfully' };
    }

    @ApiOperation({ summary: 'List registered MFA devices' })
    @ApiResponse({ status: 200, type: [MfaDeviceDto] })
    @HttpCode(200)
    @Get('devices')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async listDevices(): Promise<MfaDeviceDto[]> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        this.mfaService.requireMfaEnabledForApp(true);
        return await this.mfaService.getTotpDevices(user.id);
    }

    @ApiOperation({ summary: 'Remove a registered MFA device' })
    @ApiResponse({ status: 200, type: NestAuthMfaDeviceRemovedResponseDto })
    @HttpCode(200)
    @Delete('devices/:deviceId')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async removeDevice(@Param('deviceId') deviceId: string): Promise<NestAuthMfaDeviceRemovedResponseDto> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        this.mfaService.requireMfaEnabledForApp(true);
        await this.mfaService.removeTotpDevice(deviceId, user.id);
        return { message: 'MFA device removed successfully' };
    }

    @ApiOperation({ summary: 'Send MFA code for setup/verification' })
    @ApiResponse({ status: 200, type: NestAuthMfaCodeSentResponseDto })
    @HttpCode(200)
    @Post('challenge')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async challenge(@Body() input: NestAuthSendMfaCodeRequestDto): Promise<NestAuthMfaCodeSentResponseDto> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        await this.mfaService.sendMfaCode(user.id, input.method);
        return { message: 'MFA code sent successfully' };
    }

    // These routes skip MFA verification
    @ApiOperation({ summary: 'Setup TOTP Device' })
    @HttpCode(200)
    @Post('setup-totp')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async setupTotp(@Body() input?: NestAuthSetupTotpRequestDto) {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const config = this.authConfig.getConfig();

        // Get app name from config, fallback to default
        const appName = config.appName;

        // Get user email - try from JWT token first, then from database
        let userEmail = user.email;
        if (!userEmail) {
            const fullUser = await NestAuthUser.findOne({ where: { id: user.id } });
            userEmail = fullUser?.email || 'User';
        }

        // Stored device name (not shown in the authenticator). The `label` (shown
        // in the app, under the issuer) is resolved by the service — defaults to
        // the user's email; the caller can override it (e.g. tenant-qualified).
        const deviceName = input?.deviceName || `${appName} : ${userEmail}`;

        const { secret, qrCode, otpAuthUrl, issuer, account } =
            await this.mfaService.setupTotpDevice(user.id, deviceName, input?.label);
        return { secret, qrCode, otpAuthUrl, issuer, account };
    }

    @ApiOperation({ summary: 'Verify TOTP Setup' })
    @ApiResponse({ status: 200, type: NestAuthMfaDeviceVerifiedResponseDto })
    @HttpCode(200)
    @Post('verify-totp-setup')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async verifyTotpSetup(@Body() input: NestAuthVerifyTotpSetupRequestDto): Promise<NestAuthMfaDeviceVerifiedResponseDto> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        const isValid = await this.mfaService.verifyTotpSetup(user.id, input.secret, input.otp);

        if (!isValid) {
            throw new UnauthorizedException({
                message: 'Invalid OTP',
                code: MFA_ERROR_CODES.MFA_CODE_INVALID
            });
        }
        return { message: 'Device setup successfully' };
    }

    @ApiOperation({ summary: 'Generate Recovery Codes' })
    @HttpCode(200)
    @Post('generate-recovery-code')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async generateRecoveryCodes() {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Generate recovery codes
        const code = await this.mfaService.generateRecoveryCode(user.id);
        return { code };
    }

    @ApiOperation({ summary: 'Reset TOTP Device' })
    @ApiResponse({ status: 200, type: NestAuthMfaResetResponseDto })
    @HttpCode(200)
    @Post('reset-totp')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async resetTotp(@Body('code') code: string): Promise<NestAuthMfaResetResponseDto> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        
        await this.mfaService.resetMfa(user.id, code);
        return { message: 'MFA reset successfully' };
    }
}
