import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDefined } from 'class-validator';
import { IToggleMfaRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthToggleMfaRequestDto implements IToggleMfaRequest {
    @ApiProperty({
        description: 'Whether MFA should be enabled for the current user',
        example: true,
    })
    @IsDefined()
    @IsBoolean()
    enabled: boolean;
}
