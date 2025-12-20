import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'passwordNotSameAsCurrent', async: false })
class PasswordNotSameAsCurrent implements ValidatorConstraintInterface {
    validate(newPassword: string, args: ValidationArguments) {
        const obj = args.object as any;
        return typeof newPassword === 'string' && newPassword !== obj.currentPassword;
    }
    defaultMessage(_args: ValidationArguments) {
        return 'New password must be different from the current password';
    }
}

export class ChangePasswordRequestDto {
    @ApiProperty({
        description: 'Current password',
        example: 'DemoOwner1!',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    currentPassword: string;

    @ApiProperty({
        description: 'New password',
        example: 'DemoOwner1!New',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    @Validate(PasswordNotSameAsCurrent)
    newPassword: string;
}
