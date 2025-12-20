import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
    @IsString()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    secretKey: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        { message: 'Password must contain uppercase, lowercase, number, and special character' }
    )
    newPassword: string;
}
