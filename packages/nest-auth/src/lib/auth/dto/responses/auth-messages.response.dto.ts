import { ApiProperty } from '@nestjs/swagger';
import { IMessageResponse } from '@ackplus/nest-auth-contracts';

export class NestAuthLogoutResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'Logged out successfully' })
    message: string;
}

export class NestAuthLogoutAllResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'Logged out from all devices' })
    message: string;
}

export class NestAuthPasswordResetLinkSentResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'If your email is registered, you will receive a password reset link' })
    message: string;
}

export class NestAuthPasswordResetResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'Password has been reset successfully' })
    message: string;
}

export class NestAuthEmailVerificationSentResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'Verification email sent' })
    message: string;
}

export class NestAuthEmailVerifiedResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'Email verified successfully' })
    message: string;
}

export class NestAuthMfaToggleResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'MFA enabled successfully' })
    message: string;
}

export class NestAuthMfaDeviceRemovedResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'Device removed successfully' })
    message: string;
}

export class NestAuthMfaCodeSentResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'MFA code sent successfully' })
    message: string;
}

export class NestAuthVerifyMfaResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'MFA verified successfully' })
    message: string;
}

export class NestAuthMfaDeviceVerifiedResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'Device setup successfully' })
    message: string;
}

export class NestAuthMfaResetResponseDto implements IMessageResponse {
    @ApiProperty({ description: 'Response message', example: 'MFA reset successfully' })
    message: string;
}
