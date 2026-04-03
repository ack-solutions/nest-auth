import { Controller, Post, Body, Get, UseGuards, Res, HttpCode, Query, Param, UnauthorizedException, Req, BadRequestException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { NestAuthVerify2faRequestDto } from '../dto/requests/verify-2fa.request.dto';
import { NestAuthRefreshTokenRequestDto } from '../dto/requests/refresh-token.request.dto';
import { Request, Response } from 'express';
import { ApiResponse } from '@nestjs/swagger';
import { ApiOperation } from '@nestjs/swagger';
import { AuthWithTokensResponseDto, UserResponseDto, Verify2faWithTokensResponseDto } from '../dto/responses/auth.response.dto';
import { AuthCookieResponseDto } from '../dto/responses/auth-cookie.response.dto';
import { NestAuthSignupRequestDto } from '../dto/requests/signup.request.dto';
import {
    NestAuthLogoutResponseDto,
    NestAuthLogoutAllResponseDto,
    NestAuthPasswordResetLinkSentResponseDto,
    NestAuthPasswordResetResponseDto,
    NestAuthEmailVerificationSentResponseDto,
    NestAuthEmailVerifiedResponseDto,
    NestAuthPhoneVerificationSentResponseDto,
    NestAuthPhoneVerifiedResponseDto,
    NestAuthMfaCodeSentResponseDto
} from '../dto/responses/auth-messages.response.dto';
import { NestAuthLoginRequestDto } from '../dto/requests/login.request.dto';
import { RequestContext } from '../../request-context/request-context';
import { MessageResponseDto, SkipMfa } from '../../core';
import { ISessionUserData, NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';
import { NestAuthForgotPasswordRequestDto } from '../dto/requests/forgot-password.request.dto';
import { NestAuthAuthGuard } from '../guards/auth.guard';
import { NestAuthVerifyForgotPasswordOtpRequestDto } from '../dto/requests/verify-forgot-password-otp-request-dto';
import { NestAuthResetPasswordWithTokenRequestDto } from '../dto/requests/reset-password-with-token.request.dto';
import { VerifyOtpResponseDto } from '../dto/responses/verify-otp.response.dto';
import { NestAuthChangePasswordRequestDto } from '../dto/requests/change-password.request.dto';
import { NestAuthSendEmailVerificationRequestDto } from '../dto/requests/send-email-verification.request.dto';
import { NestAuthVerifyEmailRequestDto } from '../dto/requests/verify-email.request.dto';
import { NestAuthSendPhoneVerificationRequestDto } from '../dto/requests/send-phone-verification.request.dto';
import { NestAuthVerifyPhoneRequestDto } from '../dto/requests/verify-phone.request.dto';
import { NestAuthSwitchTenantRequestDto } from '../dto/requests/switch-tenant.request.dto';
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '../../auth.constants';

import { UseInterceptors, UseFilters } from '@nestjs/common';
import { PasswordService } from '../services/password.service';
import { VerificationService } from '../services/verification.service';
import { TokenResponseInterceptor } from '../interceptors/token-response.interceptor';
import { AuthExceptionFilter } from '../filters/auth-exception.filter';

import { Auth } from '../../core/decorators/auth.decorator';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { TenantModeEnum } from '@ackplus/nest-auth-contracts';
import { NestAuthPasswordlessSendRequestDto } from '../dto/requests/passwordless-send.request.dto';
import { CookieHelper } from '../../utils/cookie.helper';

@Controller('auth')
@UseFilters(AuthExceptionFilter)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly passwordService: PasswordService,
        private readonly verificationService: VerificationService,
        private readonly authConfigService: AuthConfigService,
        private readonly tenantService: TenantService,
    ) { }

    // Helper methods for response handling are now handled by TokenResponseInterceptor

    @ApiOperation({
        summary: 'Signup',
        description: 'Register a new user. Response format depends on accessTokenType configuration:\n' +
            '- Header mode (default): Returns tokens in response body\n' +
            '- Cookie mode: Sets tokens in HTTP-only cookies and returns success message'
    })
    @ApiResponse({ status: 200, type: AuthWithTokensResponseDto, description: 'Header mode: Returns message + tokens in body' })
    @ApiResponse({ status: 200, type: AuthCookieResponseDto, description: 'Cookie mode: Returns message only, tokens in cookies' })
    @HttpCode(200)
    @Post('signup')
    @UseInterceptors(TokenResponseInterceptor)
    async signup(@Body() input: NestAuthSignupRequestDto): Promise<AuthWithTokensResponseDto> {
        const response = await this.authService.signup(input);
        return {
            ...response,
            message: 'Signup successful',
        };
    }

    @ApiOperation({
        summary: 'Login',
        description: 'Authenticate user. Response format depends on accessTokenType configuration:\n' +
            '- Header mode (default): Returns tokens in response body\n' +
            '- Cookie mode: Sets tokens in HTTP-only cookies and returns success message'
    })
    @ApiResponse({ status: 200, type: AuthWithTokensResponseDto, description: 'Header mode: Returns message + tokens in body' })
    @ApiResponse({ status: 200, type: AuthCookieResponseDto, description: 'Cookie mode: Returns message only, tokens in cookies' })
    @HttpCode(200)
    @Post('login')
    @UseInterceptors(TokenResponseInterceptor)
    async login(@Body() input: NestAuthLoginRequestDto): Promise<AuthWithTokensResponseDto> {
        const response = await this.authService.login(input);
        return {
            ...response,
            message: 'Login successful',
        };
    }

    @ApiOperation({ summary: 'Passwordless — send login code (email or SMS)' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('passwordless/send')
    @SkipMfa()
    async passwordlessSend(@Body() input: NestAuthPasswordlessSendRequestDto): Promise<MessageResponseDto> {
        return this.authService.passwordlessSend(input);
    }

    @ApiOperation({
        summary: 'Refresh Token',
        description: 'Refresh access token. Response format depends on accessTokenType configuration:\n' +
            '- Header mode (default): Returns new tokens in response body\n' +
            '- Cookie mode: Sets new tokens in HTTP-only cookies and returns success message'
    })
    @ApiResponse({ status: 200, type: AuthWithTokensResponseDto, description: 'Header mode: Returns message + tokens in body' })
    @ApiResponse({ status: 200, type: AuthCookieResponseDto, description: 'Cookie mode: Returns message only, tokens in cookies' })
    @HttpCode(200)
    @Post('refresh-token')
    @UseInterceptors(TokenResponseInterceptor)
    async refreshToken(
        @Body() input: NestAuthRefreshTokenRequestDto,
        @Req() req: Request,
    ): Promise<AuthWithTokensResponseDto> {
        const headerTokenType = req.headers['x-access-token-type'];
        const accessTokenType = AuthConfigService.getOptions().session?.accessTokenType ?? null;
        const isCookieMode = accessTokenType === 'cookie' || (!accessTokenType && headerTokenType === 'cookie');


        const refreshToken = input.refreshToken || (isCookieMode ? CookieHelper.get(req, REFRESH_TOKEN_COOKIE_NAME) : undefined);

        if (!refreshToken) {
            throw new BadRequestException('refreshToken is required');
        }

        const response = await this.authService.refreshToken(refreshToken);
        return {
            ...response,
            isRequiresMfa: false,
            message: 'Token refreshed successfully',
        };
    }


    @ApiOperation({ summary: 'Send MFA Code' })
    @ApiResponse({ status: 200, type: NestAuthMfaCodeSentResponseDto })
    @HttpCode(200)
    @Post('mfa/challenge')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async send2faCode(@Body('method') method: NestAuthMFAMethodEnum): Promise<NestAuthMfaCodeSentResponseDto> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        await this.authService.send2faCode(user.id, method!);
        return { message: 'MFA code sent successfully' }
    }

    @ApiOperation({
        summary: 'Verify MFA',
        description: 'Verify multi-factor authentication. Response format depends on accessTokenType configuration:\n' +
            '- Header mode (default): Returns tokens in response body\n' +
            '- Cookie mode: Sets tokens in HTTP-only cookies and returns success message'
    })
    @ApiResponse({ status: 200, type: Verify2faWithTokensResponseDto, description: 'Header mode: Returns message + tokens in body' })
    @ApiResponse({ status: 200, type: AuthCookieResponseDto, description: 'Cookie mode: Returns message only, tokens in cookies' })
    @HttpCode(200)
    @Post('mfa/verify')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    @UseInterceptors(TokenResponseInterceptor)
    async verify2fa(@Body() input: NestAuthVerify2faRequestDto): Promise<Verify2faWithTokensResponseDto> {
        const response = await this.authService.verify2fa(input);
        return {
            ...response,
            message: '2FA verification successful',
        };
    }

    @ApiOperation({ summary: 'Logout' })
    @ApiResponse({ status: 200, type: NestAuthLogoutResponseDto })
    @HttpCode(200)
    @Post('logout')
    @SkipMfa()
    @Auth(true)
    async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request): Promise<NestAuthLogoutResponseDto> {
        // Try safe logout if user is present
        try {
            if ((req as any).user) {
                await this.authService.logout();
            }
        } catch (e) {
            // Ignore session revocation errors if user not found/invalid
        }

        // Clear cookies with the same options they were set with (especially path)
        // Cookies must be cleared with matching path option, otherwise browser won't remove them
        res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, { path: '/' });
        res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });

        return { message: 'Logged out successfully' };
    }

    @ApiOperation({ summary: 'Logout All' })
    @ApiResponse({ status: 200, type: NestAuthLogoutAllResponseDto })
    @HttpCode(200)
    @Post('logout-all')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async logoutAll(@Res({ passthrough: true }) res: Response): Promise<NestAuthLogoutAllResponseDto> {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        await this.authService.logoutAll(user.id!);

        // Clear cookies for the current device as well
        res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, { path: '/' });
        res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });

        return { message: 'Logged out from all devices successfully' };
    }

    @ApiOperation({ summary: 'Switch Active Tenant' })
    @ApiResponse({ status: 200, type: AuthWithTokensResponseDto })
    @HttpCode(200)
    @Post('switch-tenant')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    @UseInterceptors(TokenResponseInterceptor)
    async switchTenant(@Body() input: NestAuthSwitchTenantRequestDto): Promise<AuthWithTokensResponseDto> {
        const response = await this.authService.switchTenant(input.tenantId);
        return {
            ...response,
            message: 'Tenant switched successfully',
        };
    }

    @ApiOperation({ summary: 'Get Session User Data and menage extra user data from config' })
    @ApiResponse({ status: 200, description: 'Current user data' })
    @HttpCode(200)
    @Get('me')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    @UseInterceptors(TokenResponseInterceptor)
    sessionUserData(): Promise<ISessionUserData> {
        return this.authService.getSessionUserData();
    }

    @ApiOperation({ summary: 'Change Password' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('change-password')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    @UseInterceptors(TokenResponseInterceptor)
    changePassword(@Body() input: NestAuthChangePasswordRequestDto): Promise<MessageResponseDto> {
        return this.passwordService.changePassword(input);
    }

    @ApiOperation({ summary: 'Forgot password' })
    @ApiResponse({ status: 200, type: NestAuthPasswordResetLinkSentResponseDto })
    @HttpCode(200)
    @Post('forgot-password')
    @SkipMfa()
    async forgotPassword(@Body() input: NestAuthForgotPasswordRequestDto): Promise<NestAuthPasswordResetLinkSentResponseDto> {
        await this.passwordService.forgotPassword(input);
        return { message: 'If your email is registered, you will receive a password reset link' };
    }

    @ApiOperation({ summary: 'Verify Forgot Password OTP and get reset token' })
    @ApiResponse({ status: 200, type: VerifyOtpResponseDto })
    @HttpCode(200)
    @Post('verify-forgot-password-otp')
    @SkipMfa()
    async verifyForgotPasswordOtp(@Body() input: NestAuthVerifyForgotPasswordOtpRequestDto): Promise<VerifyOtpResponseDto> {
        return await this.passwordService.verifyForgotPasswordOtp(input);
    }

    @ApiOperation({ summary: 'Reset password' })
    @ApiResponse({ status: 200, type: NestAuthPasswordResetResponseDto })
    @HttpCode(200)
    @Post('reset-password')
    @SkipMfa()
    async resetPassword(@Body() input: NestAuthResetPasswordWithTokenRequestDto): Promise<NestAuthPasswordResetResponseDto> {
        await this.passwordService.resetPasswordWithToken(input);
        return { message: 'Password has been reset successfully' };
    }

    @ApiOperation({
        summary: 'Client config',
        description: 'Public configuration for clients (tenant mode, auth methods, registration, MFA, etc.). No auth required.',
    })
    @ApiResponse({ status: 200, description: 'Client configuration' })
    @Get('client-config')
    async getClientConfig() {
        const config = this.authConfigService.getConfig();

        const defaultResponse = {
            tenants: {
                enabled: config.tenant?.enabled,
                mode: config.tenant!.mode ?? TenantModeEnum.ISOLATED,
            },
            roleGuards: this.authConfigService.getRoleGuards(),
            emailAuth: { enabled: config.emailAuth?.enabled !== false },
            phoneAuth: { enabled: config.phoneAuth?.enabled === true },
            registration: {
                enabled: config.registration?.enabled !== false,
                requireInvitation: config.registration?.requireInvitation ?? false,
                collectProfileFields: config.registration?.collectProfileFields,
            },
            mfa: config.mfa
                ? {
                    enabled: config.mfa.enabled ?? false,
                    methods: config.mfa.methods,
                    allowUserToggle: config.mfa.allowUserToggle,
                    allowMethodSelection: config.mfa.allowMethodSelection,
                }
                : { enabled: false },
        };

        if (config.clientConfig?.factory) {
            return config.clientConfig.factory(defaultResponse, {
                configService: this.authConfigService,
                tenantService: this.tenantService,
            });
        }
        return defaultResponse;
    }

    @ApiOperation({ summary: 'Get Logged In User' })
    @ApiResponse({ status: 200, type: UserResponseDto })
    @UseGuards(NestAuthAuthGuard)
    @Get('user')
    async getUser() {
        const user = await RequestContext.currentUser();
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user
    }

    @ApiOperation({
        summary: 'Verify Session',
        description: 'Lightweight endpoint to verify if the current session is valid. Returns minimal information without fetching full user data.'
    })
    @ApiResponse({
        status: 200,
        schema: {
            properties: {
                valid: { type: 'boolean', example: true },
                userId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
                expiresAt: { type: 'string', example: '2024-01-01T12:00:00.000Z' }
            }
        }
    })
    @UseGuards(NestAuthAuthGuard)
    @SkipMfa()
    @Get('verify-session')
    async verifySession() {
        const userId = await RequestContext.currentUserId();
        const session = RequestContext.currentSession();
        return {
            valid: true,
            userId: userId,
            expiresAt: session?.expiresAt?.toISOString(),
        };
    }

    @ApiOperation({ summary: 'Send email verification' })
    @ApiResponse({ status: 200, type: NestAuthEmailVerificationSentResponseDto })
    @HttpCode(200)
    @Post('send-email-verification')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async sendEmailVerification(@Body() input: NestAuthSendEmailVerificationRequestDto): Promise<NestAuthEmailVerificationSentResponseDto> {
        await this.verificationService.sendEmailVerification(input);
        return { message: 'Verification email sent' };
    }

    @ApiOperation({ summary: 'Verify Email' })
    @ApiResponse({ status: 200, type: NestAuthEmailVerifiedResponseDto })
    @HttpCode(200)
    @Post('verify-email')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async verifyEmail(@Body() input: NestAuthVerifyEmailRequestDto): Promise<NestAuthEmailVerifiedResponseDto> {
        await this.verificationService.verifyEmail(input);
        return { message: 'Email verified successfully' };
    }

    @ApiOperation({ summary: 'Send phone verification (SMS OTP)' })
    @ApiResponse({ status: 200, type: NestAuthPhoneVerificationSentResponseDto })
    @HttpCode(200)
    @Post('send-phone-verification')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async sendPhoneVerification(@Body() input: NestAuthSendPhoneVerificationRequestDto): Promise<NestAuthPhoneVerificationSentResponseDto> {
        await this.verificationService.sendPhoneVerification(input);
        return { message: 'Verification SMS sent' };
    }

    @ApiOperation({ summary: 'Verify phone number with OTP' })
    @ApiResponse({ status: 200, type: NestAuthPhoneVerifiedResponseDto })
    @HttpCode(200)
    @Post('verify-phone')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async verifyPhone(@Body() input: NestAuthVerifyPhoneRequestDto): Promise<NestAuthPhoneVerifiedResponseDto> {
        await this.verificationService.verifyPhone(input);
        return { message: 'Phone verified successfully' };
    }

    @ApiOperation({
        summary: 'SSO Callback',
        description: 'OAuth callback endpoint for SSO providers. Exchanges authorization code for access token and returns raw SSO user info. Returns HTML page that posts SSO data to parent window and auto-closes.',
    })
    @Get('callback/:provider')
    async ssoCallback(
        @Param('provider') provider: string,
        @Query() data: any,
        @Res() res: Response,
    ) {

        const jsonData = JSON.stringify(data);
        const escapedData = jsonData.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSO Callback</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .message {
            color: #333;
            margin-top: 1rem;
        }
        .error {
            color: #dc3545;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div class="message" id="message">Processing...</div>
    </div>
    <script>
        (function() {
            const data = ${escapedData};

            // Post message to parent window
            if (window.opener) {
                window.opener.postMessage({
                    type: 'nest-auth-sso-callback',
                    ...data
                }, '*');

                // Auto-close immediately
                window.close();
            } else if (window.parent && window.parent !== window) {
                // Iframe context
                window.parent.postMessage({
                    type: 'nest-auth-sso-callback',
                    ...data
                }, '*');
                // Note: Can't close iframe from inside
            } else {
                // No parent window, show message
                document.getElementById('message').textContent = data.success
                    ? 'Success! You can close this window.'
                    : 'Error: ' + (data.errorDescription || data.error);
                document.getElementById('message').className = data.success ? 'message' : 'message error';
            }
        })();
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
    }

}
