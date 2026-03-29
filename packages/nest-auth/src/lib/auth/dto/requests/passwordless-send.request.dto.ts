import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IPasswordlessSendRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthPasswordlessSendRequestDto implements IPasswordlessSendRequest {
    @ApiProperty({
        description: 'Email or phone (per `channel`)',
        example: 'user@example.com',
    })
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @ApiProperty({ enum: ['email', 'sms'] })
    @IsEnum(['email', 'sms'])
    channel: 'email' | 'sms';

    @ApiPropertyOptional()
    @IsUUID()
    @IsOptional()
    tenantId?: string;
}
