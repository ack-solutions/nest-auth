import { Controller, Post, Body, Get, UseGuards, Res, HttpCode, Query, Param } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { Verify2faRequestDto } from '../dto/requests/verify-2fa.request.dto';
import { RefreshTokenRequestDto } from '../dto/requests/refresh-token.request.dto';
import { Response } from 'express';
import { ApiResponse } from '@nestjs/swagger';
import { ApiOperation } from '@nestjs/swagger';
import { CookieService } from '../services/cookie.service';
import { AuthConfigService } from '../../core/services/auth-config.service';
import { AuthWithTokensResponseDto, UserResponseDto, Verify2faWithTokensResponseDto } from '../dto/responses/auth.response.dto';
import { AuthCookieResponseDto } from '../dto/responses/auth-cookie.response.dto';
import { SignupRequestDto } from '../dto/requests/signup.request.dto';
import { LoginRequestDto } from '../dto/requests/login.request.dto';
import { RequestContext } from '../../request-context/request-context';
import { MessageResponseDto, MFAMethodEnum, SkipMfa } from '../../core';
import { ForgotPasswordRequestDto } from '../dto/requests/forgot-password.request.dto';
import { ResetPasswordRequestDto } from '../dto/requests/reset-password.request.dto';
import { NestAuthAuthGuard } from '../guards/auth.guard';
import { VerifyForgotPasswordOtpRequestDto } from '../dto/requests/verify-forgot-password-otp-request-dto';
import { ResetPasswordWithTokenRequestDto } from '../dto/requests/reset-password-with-token.request.dto';
import { VerifyOtpResponseDto } from '../dto/responses/verify-otp.response.dto';
import { ChangePasswordRequestDto } from '../dto/requests/change-password.request.dto';
import { SendEmailVerificationRequestDto } from '../dto/requests/send-email-verification.request.dto';
import { VerifyEmailRequestDto } from '../dto/requests/verify-email.request.dto';
import { ClientConfigService } from '../services/client-config.service';
import { ClientConfigResponseDto } from '../dto/responses/client-config.response.dto';
import { NEST_AUTH_TRUST_DEVICE_KEY } from '../../auth.constants';


@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly cookieService: CookieService,
        private readonly authConfig: AuthConfigService,
        private readonly clientConfigService: ClientConfigService,
    ) { }

    /**
     * Check if using cookie-based authentication
     */
    protected isUsingCookies(): boolean {
        const config = this.authConfig.getConfig();
        return config.accessTokenType === 'cookie';
    }

    /**
     * Handle auth response based on configuration
     * - If cookie mode: Sets tokens in cookies, returns success message
     * - If header mode: Returns tokens in response body
     */
    protected handleAuthResponse(
        res: Response,
        authResult: { accessToken: string; refreshToken: string; isRequiresMfa: boolean },
        successMessage: string = 'Authentication successful'
    ): void {
        if (this.isUsingCookies()) {
            // Cookie mode: Set tokens in cookies, return success message
            this.cookieService.setTokens(res, authResult.accessToken, authResult.refreshToken);
            res.status(200).json({
                message: successMessage,
                isRequiresMfa: authResult.isRequiresMfa
            } as AuthCookieResponseDto);
        } else {
            // Header mode: Return tokens in response body
            res.status(200).json({
                message: successMessage,
                accessToken: authResult.accessToken,
                refreshToken: authResult.refreshToken,
                isRequiresMfa: authResult.isRequiresMfa
            } as AuthWithTokensResponseDto);
        }
    }

    /**
     * Handle 2FA verification response based on configuration
     */
    protected handle2faResponse(
        res: Response,
        authResult: { accessToken: string; refreshToken: string; trustToken?: string }
    ): void {
        if (authResult.trustToken) {
            const trustCookieName = AuthConfigService.getOptions().mfa?.trustDeviceStorageName || NEST_AUTH_TRUST_DEVICE_KEY;
            const duration = AuthConfigService.getOptions().mfa?.trustedDeviceDuration || '30d';
            // Convert duration to milliseconds for maxAge
            const ms = require('ms');
            const maxAge = typeof duration === 'string' ? ms(duration) : duration;

            res.cookie(trustCookieName, authResult.trustToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge,
            });
        }

        if (this.isUsingCookies()) {
            // Cookie mode: Set tokens in cookies, return success message
            this.cookieService.setTokens(res, authResult.accessToken, authResult.refreshToken);
            res.status(200).json({
                message: '2FA verification successful',
                // Note: No isRequiresMfa for 2FA verification (it's already verified)
                trustToken: authResult.trustToken // Return trust token for mobile apps even in cookie mode
            } as AuthCookieResponseDto & { trustToken?: string });
        } else {
            // Header mode: Return message AND tokens in response body
            res.status(200).json({
                message: '2FA verification successful',
                accessToken: authResult.accessToken,
                refreshToken: authResult.refreshToken,
                trustToken: authResult.trustToken
            } as Verify2faWithTokensResponseDto & { trustToken?: string });
        }
    }

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
    async signup(@Body() input: SignupRequestDto, @Res() res: Response) {
        const response = await this.authService.signup(input);
        this.handleAuthResponse(res, response, 'Signup successful');
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
    async login(@Body() input: LoginRequestDto, @Res() res: Response) {
        const response = await this.authService.login(input);
        this.handleAuthResponse(res, response, 'Login successful');
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
    async refreshToken(@Body() input: RefreshTokenRequestDto, @Res() res: Response) {
        const response = await this.authService.refreshToken(input.refreshToken);
        // Note: Refresh response doesn't have isRequiresMfa, so we create a compatible object
        this.handleAuthResponse(res, { ...response, isRequiresMfa: false }, 'Token refreshed successfully');
    }


    @ApiOperation({ summary: 'Send 2FA Code' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('send-2fa-code')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async send2faCode(@Body('method') method: MFAMethodEnum) {
        const user = RequestContext.currentUser();
        await this.authService.send2faCode(user.id, method);
        return { message: '2FA code sent successfully' }
    }

    @ApiOperation({
        summary: 'Verify 2FA',
        description: 'Verify two-factor authentication. Response format depends on accessTokenType configuration:\n' +
            '- Header mode (default): Returns tokens in response body\n' +
            '- Cookie mode: Sets tokens in HTTP-only cookies and returns success message'
    })
    @ApiResponse({ status: 200, type: Verify2faWithTokensResponseDto, description: 'Header mode: Returns message + tokens in body' })
    @ApiResponse({ status: 200, type: AuthCookieResponseDto, description: 'Cookie mode: Returns message only, tokens in cookies' })
    @HttpCode(200)
    @Post('verify-2fa')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async verify2fa(@Body() input: Verify2faRequestDto, @Res() res: Response) {
        const response = await this.authService.verify2fa(input);
        this.handle2faResponse(res, response);
    }

    @ApiOperation({ summary: 'Logout' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('logout')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async logout(@Res() res: Response) {
        await this.authService.logout();

        // Only clear cookies if using cookie-based auth
        if (this.isUsingCookies()) {
            this.cookieService.clearCookies(res);
        }

        res.status(200).json({ message: 'Logged out successfully' });
    }

    @ApiOperation({ summary: 'Logout All' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('logout-all')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async logoutAll(): Promise<MessageResponseDto> {
        const user = RequestContext.currentUser();
        await this.authService.logoutAll(user.id);
        return { message: 'Logged out from all devices successfully' };
    }

    @ApiOperation({ summary: 'Change Password' })
    @ApiResponse({ status: 200, type: AuthWithTokensResponseDto })
    @HttpCode(200)
    @Post('change-password')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async changePassword(@Body() input: ChangePasswordRequestDto, @Res() res: Response) {
        const response = await this.authService.changePassword(input);
        this.handleAuthResponse(res, response, 'Password updated successfully');
    }

    @ApiOperation({ summary: 'Forgot Password' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('forgot-password')
    @SkipMfa()
    async forgotPassword(@Body() input: ForgotPasswordRequestDto): Promise<MessageResponseDto> {
        await this.authService.forgotPassword(input);
        return { message: 'If the account exists, a password reset code has been sent' }
    }

    @ApiOperation({ summary: 'Verify Forgot Password OTP and get reset token' })
    @ApiResponse({ status: 200, type: VerifyOtpResponseDto })
    @HttpCode(200)
    @Post('verify-forgot-password-otp')
    @SkipMfa()
    async verifyForgotPasswordOtp(@Body() input: VerifyForgotPasswordOtpRequestDto): Promise<VerifyOtpResponseDto> {
        return await this.authService.verifyForgotPasswordOtp(input);
    }

    @ApiOperation({ summary: 'Reset Password with Token' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('reset-password')
    @SkipMfa()
    async resetPassword(@Body() input: ResetPasswordWithTokenRequestDto): Promise<MessageResponseDto> {
        await this.authService.resetPasswordWithToken(input);
        return { message: 'Password reset successfully' }
    }

    @ApiOperation({ summary: 'Get Logged In User' })
    @ApiResponse({ status: 200, type: UserResponseDto })
    @UseGuards(NestAuthAuthGuard)
    @Get('user')
    async getUser() {
        return await this.authService.getUser();
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
    @Get('verify-session')
    async verifySession() {
        const user = RequestContext.currentUser();
        const session = RequestContext.currentSession();
        return {
            valid: true,
            userId: user?.id,
            expiresAt: session?.expiresAt?.toISOString(),
        };
    }

    @ApiOperation({ summary: 'Send Email Verification' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('send-email-verification')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async sendEmailVerification(@Body() input: SendEmailVerificationRequestDto): Promise<MessageResponseDto> {
        return await this.authService.sendEmailVerification(input);
    }

    @ApiOperation({ summary: 'Verify Email' })
    @ApiResponse({ status: 200, type: MessageResponseDto })
    @HttpCode(200)
    @Post('verify-email')
    @SkipMfa()
    @UseGuards(NestAuthAuthGuard)
    async verifyEmail(@Body() input: VerifyEmailRequestDto): Promise<MessageResponseDto> {
        return await this.authService.verifyEmail(input);
    }

    @ApiOperation({
        summary: 'Get Client Configuration',
        description: 'Returns backend configuration for frontend clients. Includes enabled auth methods, registration settings, MFA options, tenant configuration, and SSO providers. Can be customized via clientConfig.factory in AuthModuleOptions.',
    })
    @ApiResponse({ status: 200, type: ClientConfigResponseDto })
    @HttpCode(200)
    @Get('client-config')
    async getClientConfig(): Promise<ClientConfigResponseDto> {
        return await this.clientConfigService.getClientConfig();
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
