import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AdminAddBlockedDomainsDto {
    @ApiProperty({
        description: 'One or more email domains to block (e.g. ["mailinator.com", "guerrillamail.com"]).',
        type: [String],
        example: ['mailinator.com', 'guerrillamail.com'],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    domains: string[];
}
