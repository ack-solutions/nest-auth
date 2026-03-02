import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MagicLinkChallengeResponseDto {
    @ApiProperty({ example: 'If the account exists, a magic link has been sent' })
    message: string;

    @ApiPropertyOptional({
        description: 'Magic link token returned only in debug mode for local testing',
    })
    token?: string;
}
