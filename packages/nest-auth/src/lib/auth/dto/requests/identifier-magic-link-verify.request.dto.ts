import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IIdentifierMagicLinkLoginVerifyRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthIdentifierMagicLinkVerifyRequestDto implements IIdentifierMagicLinkLoginVerifyRequest {
    @ApiProperty({
        description: 'Magic link token',
    })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiPropertyOptional({
        description: 'Guard context for role isolation',
        example: 'admin',
    })
    @IsString()
    @IsOptional()
    guard?: string;
}
