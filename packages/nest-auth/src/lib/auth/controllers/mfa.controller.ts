import { Controller, Post, Body, UnauthorizedException, UseGuards, HttpCode, Get, Delete, Param } from '@nestjs/common';
import { SkipMfa, MessageResponseDto, MFAMethodEnum, NestAuthUser } from '../../core';
import { MfaService } from '../services/mfa.service';
import { RequestContext } from '../../request-context/request-context';
import { SendMfaCodeRequestDto } from '../dto/requests/send-mfa-code.request.dto';
import { VerifyTotpSetupRequestDto } from '../dto/requests/verify-totp-setup.request.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { INVALID_MFA_EXCEPTION_CODE, USER_NOT_FOUND_EXCEPTION_CODE } from '../../auth.constants';
import { NestAuthAuthGuard } from '../guards/auth.guard';
import { ToggleMfaRequestDto } from '../dto/requests/toggle-mfa.request.dto';
import { MfaStatusResponseDto, MfaDeviceDto } from '../dto/responses/mfa-status.response.dto';
import { AuthConfigService } from '../../core/services/auth-config.service';

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

        let verifiedMethods: MFAMethodEnum[] = [];
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
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('toggle')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async toggleMfa(@Body() input: ToggleMfaRequestDto): Promise<MessageResponseDto> {
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
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Delete('devices/:deviceId')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async removeDevice(@Param('deviceId') deviceId: string): Promise<MessageResponseDto> {
        const user = this.getCurrentUserOrThrow();

        this.mfaService.requireMfaEnabledForApp(true);
        await this.mfaService.removeTotpDevice(deviceId);
        return { message: 'MFA device removed successfully' };
    }

    @ApiOperation({ summary: 'Send MFA Code' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('send-mfa-code')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async sendMfaCode(@Body() input: SendMfaCodeRequestDto) {
        const user = this.getCurrentUserOrThrow();

        await this.mfaService.sendMfaCode(user.id, input.method);

        return { message: 'MFA code sent' };
    }

    // These routes skip MFA verification
    @ApiOperation({ summary: 'Setup TOTP Device' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
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
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('verify-totp-setup')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async verifyTotpSetup(@Body() input: VerifyTotpSetupRequestDto) {
        const user = this.getCurrentUserOrThrow();

        const isVerified = await this.mfaService.verifyTotpSetup(user.id, input.secret, input.otp);
        if (!isVerified) {
            throw new UnauthorizedException({
                message: 'Invalid OTP',
                code: INVALID_MFA_EXCEPTION_CODE
            });
        }
        return { message: 'Device setup successfully' };
    }

    @ApiOperation({ summary: 'Generate Recovery Codes' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
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
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('reset-totp')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async resetTotp(@Body('code') code: string) {
        const user = this.getCurrentUserOrThrow();
        await this.mfaService.resetMfa(user.id, code);
        return { message: 'MFA reset successfully' };
    }
}
