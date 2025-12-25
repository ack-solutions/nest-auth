import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDefined } from 'class-validator';
import { IToggleMfaRequest } from '@libs/auth-types';

export class ToggleMfaRequestDto implements IToggleMfaRequest {
    @ApiProperty({
        description: 'Whether MFA should be enabled for the current user',
        example: true,
    })
    @IsDefined()
    @IsBoolean()
    enabled: boolean;
}
