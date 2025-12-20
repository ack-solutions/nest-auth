import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './auth.response.dto';

export class InitializeAdminResponseDto {
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
