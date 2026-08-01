import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

export class AdminAddBlockedDomainsDto {
    @ApiProperty({
        description: 'One or more email domains to block (e.g. ["mailinator.com", "guerrillamail.com"]). Max 1000 per request; each max 253 chars.',
        type: [String],
        example: ['mailinator.com', 'guerrillamail.com'],
    })
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(1000)
    @IsString({ each: true })
    @MaxLength(253, { each: true }) // RFC 1035 max hostname length
    domains: string[];
}
