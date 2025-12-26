import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IRefreshRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthRefreshTokenRequestDto implements IRefreshRequest {
    @ApiProperty({
        description: 'Refresh token to obtain new access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJ0eXBlIjoicmVmcmVzaCJ9.abc123',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
