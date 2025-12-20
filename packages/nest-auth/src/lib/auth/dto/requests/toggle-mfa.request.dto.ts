import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDefined } from 'class-validator';

export class ToggleMfaRequestDto {
    @ApiProperty({
        description: 'Whether MFA should be enabled for the current user',
        example: true,
    })
    @IsDefined()
    @IsBoolean()
    enabled: boolean;
}
