import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsPhoneNumber } from 'class-validator';

/**
 * Phone-based login credentials
 */
export class PhoneCredentialsDto {
    @ApiProperty({
        description: 'User phone number',
        example: '+1234567890',
    })
    @IsPhoneNumber()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecurePass123!',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}
