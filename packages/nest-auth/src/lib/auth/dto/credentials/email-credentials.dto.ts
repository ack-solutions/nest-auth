import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

/**
 * Email-based login credentials
 */
export class EmailCredentialsDto {
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecurePass123!',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}
