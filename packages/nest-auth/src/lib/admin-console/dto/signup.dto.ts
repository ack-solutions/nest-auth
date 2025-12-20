import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminSignupDto {
    @ApiProperty({
        description: 'Admin email address',
        example: 'admin@example.com'
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'Admin password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
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
        description: 'Admin name (optional)',
        required: false,
        example: 'Admin User'
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        description: 'Additional metadata for the admin user (optional)',
        required: false,
        example: { department: 'IT', role: 'super-admin' }
    })
    @IsOptional()
    metadata?: Record<string, any>;
}
