import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './auth.response.dto';
import { IInitializeAdminResponse } from '@libs/auth-types';

export class InitializeAdminResponseDto implements IInitializeAdminResponse {
    @ApiProperty({
        description: 'Success message',
        example: 'Super admin created successfully'
    })
    message: string;

    @ApiProperty({
        description: 'Created admin user details',
        type: UserResponseDto
    })
    user: UserResponseDto;

    @ApiProperty({
        description: 'Assigned role name',
        example: 'super-admin'
    })
    role: string;
}
