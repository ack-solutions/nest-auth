import { IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ISwitchTenantRequest } from '@ackplus/nest-auth-contracts';

export class NestAuthSwitchTenantRequestDto implements ISwitchTenantRequest {
    @ApiPropertyOptional({
        description: 'Tenant ID to switch into',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    tenantId: string;
}
