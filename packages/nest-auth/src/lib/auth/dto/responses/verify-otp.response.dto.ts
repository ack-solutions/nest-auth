import { ApiProperty } from '@nestjs/swagger';
import { IVerifyOtpResponse } from '@ackplus/nest-auth-contracts';

export class VerifyOtpResponseDto implements IVerifyOtpResponse {
    @ApiProperty({ description: 'Success message' })
    message: string;

    @ApiProperty({ description: 'Password reset token - use this to reset password', required: false })
    resetToken?: string;
}
