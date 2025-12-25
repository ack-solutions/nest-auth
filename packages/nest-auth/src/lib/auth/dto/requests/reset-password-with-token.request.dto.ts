import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IResetPasswordWithTokenRequest } from '@libs/auth-types';

export class ResetPasswordWithTokenRequestDto implements IResetPasswordWithTokenRequest {
    @ApiProperty({
        description: 'Password reset token (JWT) received after OTP verification',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzc3dvcmQtcmVzZXQifQ.xyz',
    })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({
        description: 'New password',
        example: 'NewSecurePass123!',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    newPassword: string;
}
