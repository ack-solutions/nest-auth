import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpResponseDto {
    @ApiProperty({ description: 'Success message' })
    message: string;

    @ApiProperty({ description: 'Password reset token - use this to reset password', required: false })
    resetToken?: string;
}
