import { Controller, Post, Body, UnauthorizedException, UseGuards, HttpCode, Get, Delete, Param } from '@nestjs/common';
import { SkipMfa, NestAuthUser } from '../../core';
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';
import { MfaService } from '../services/mfa.service';
import { RequestContext } from '../../request-context/request-context';
import { NestAuthSendMfaCodeRequestDto } from '../dto/requests/send-mfa-code.request.dto';
import { NestAuthVerifyTotpSetupRequestDto } from '../dto/requests/verify-totp-setup.request.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
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
import { MFA_ERROR_CODES } from 'src/lib/auth.constants';

@Controller('auth/mfa')
export class MfaController {
    constructor(
        private readonly mfaService: MfaService,
        private readonly authConfig: AuthConfigService,
    ) { }

    private getCurrentUserOrThrow() {
        const user = RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    @ApiOperation({ summary: 'Get MFA status for the current user' })
    @ApiResponse({ status: 200, type: MfaStatusResponseDto })
    @HttpCode(200)
    @Get('status')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async getStatus(): Promise<MfaStatusResponseDto> {
        const user = this.getCurrentUserOrThrow();

        const config = this.mfaService.mfaConfig;
        const globallyEnabled = config?.enabled ?? false;

        let verifiedMethods: NestAuthMFAMethodEnum[] = [];
        let totpDevices: MfaDeviceDto[] = [];
        let hasRecoveryCode = false;
        let isEnabled = false;

        if (globallyEnabled) {
            [verifiedMethods, totpDevices, hasRecoveryCode, isEnabled] = await Promise.all([
                this.mfaService.getVerifiedMethods(user.id),
                this.mfaService.getTotpDevices(user.id),
                this.mfaService.hasRecoveryCode(user.id),
                this.mfaService.isMfaEnabled(user.id),
            ]);
        }

        return {
            isEnabled,
            verifiedMethods,  // Methods user has verified/can use
            configuredMethods: this.mfaService.getAvailableMethods(),  // Methods configured in app
            allowUserToggle: config?.allowUserToggle ?? false,
            allowMethodSelection: config?.allowMethodSelection ?? false,
            totpDevices,
            hasRecoveryCode,
        };
    }

    @ApiOperation({ summary: 'Enable or disable MFA for the current user' })
    @ApiResponse({ status: 200, type: NestAuthMfaToggleResponseDto })
    @HttpCode(200)
    @Post('toggle')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async toggleMfa(@Body() input: NestAuthToggleMfaRequestDto): Promise<NestAuthMfaToggleResponseDto> {
        const user = this.getCurrentUserOrThrow();

        this.mfaService.requireMfaEnabledForApp(true);

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
        const user = this.getCurrentUserOrThrow();

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
        const user = this.getCurrentUserOrThrow();

        this.mfaService.requireMfaEnabledForApp(true);
        await this.mfaService.removeTotpDevice(deviceId);
        return { message: 'MFA device removed successfully' };
    }

    @ApiOperation({ summary: 'Send MFA code for setup/verification' })
    @ApiResponse({ status: 200, type: NestAuthMfaCodeSentResponseDto })
    @HttpCode(200)
    @Post('challenge')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async challenge(@Body() input: NestAuthSendMfaCodeRequestDto): Promise<NestAuthMfaCodeSentResponseDto> {
        const user = this.getCurrentUserOrThrow();
        await this.mfaService.sendMfaCode(user.id, input.method);
        return { message: 'MFA code sent successfully' };
    }

    // These routes skip MFA verification
    @ApiOperation({ summary: 'Setup TOTP Device' })
    @HttpCode(200)
    @Post('setup-totp')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async setupTotp() {
        const user = this.getCurrentUserOrThrow();

        const config = this.authConfig.getConfig();

        // Get app name from config, fallback to default
        const appName = config.appName;

        // Get user email - try from JWT token first, then from database
        let userEmail = user.email;
        if (!userEmail) {
            const fullUser = await NestAuthUser.findOne({ where: { id: user.id } });
            userEmail = fullUser?.email || 'User';
        }

        // Generate meaningful device name: {APP_NAME} : {email}
        const deviceName = `${appName} : ${userEmail}`;

        const { secret, qrCode } = await this.mfaService.setupTotpDevice(user.id, deviceName);
        return { secret, qrCode };
    }

    @ApiOperation({ summary: 'Verify TOTP Setup' })
    @ApiResponse({ status: 200, type: NestAuthMfaDeviceVerifiedResponseDto })
    @HttpCode(200)
    @Post('verify-totp-setup')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async verifyTotpSetup(@Body() input: NestAuthVerifyTotpSetupRequestDto): Promise<NestAuthMfaDeviceVerifiedResponseDto> {
        const user = RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const isValid = await this.mfaService.verifyMfa(user.id, input.otp, NestAuthMFAMethodEnum.TOTP);
        if (!isValid) { // Changed from !isVerified to !isValid to match the variable name
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
        const user = this.getCurrentUserOrThrow();

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
        const user = this.getCurrentUserOrThrow();
        await this.mfaService.resetMfa(user.id, code);
        return { message: 'MFA reset successfully' };
    }
}
