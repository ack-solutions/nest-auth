import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Matches, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitializeAdminRequestDto {
    @ApiProperty({
        description: 'Super admin email address',
        example: 'admin@example.com'
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'Super admin password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
        example: 'SecurePassword123!',
        minLength: 8
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        { message: 'Password must contain uppercase, lowercase, number, and special character' }
    )
    password: string;

    @ApiProperty({
        description: 'Secret key for authorization (provided in module configuration)',
        example: 'your-secret-key'
    })
    @IsString()
    @IsNotEmpty()
    secretKey: string;

    @ApiProperty({
        description: 'Tenant ID (optional, uses default tenant if not provided)',
        required: false
    })
    @IsOptional()
    @IsString()
    tenantId?: string;

    @ApiProperty({
        description: 'Additional metadata for the admin user (free-form object for storing firstName, lastName, department, etc.)',
        required: false,
        example: { firstName: 'Admin', lastName: 'User', department: 'IT' }
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}
