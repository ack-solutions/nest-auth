import { ApiProperty } from '@nestjs/swagger';

export class MfaCodeResponseDto {
    @ApiProperty({
        description: 'Current MFA code for testing purposes (development only)',
        example: '123456',
    })
    code: string;

    @ApiProperty({
        description: 'Code expiration timestamp',
        example: '2024-01-01T12:00:00.000Z',
    })
    expiresAt: Date;

    @ApiProperty({
        description: 'Whether the code has been used',
        example: false,
    })
    used: boolean;

    @ApiProperty({
        description: 'Warning message about development-only usage',
        example: 'This endpoint is only available in development/test environments',
    })
    warning?: string;
}
