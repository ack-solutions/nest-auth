import { IsEnum, IsString, IsNotEmpty } from "class-validator";
import { NestAuthMFAMethodEnum } from "@ackplus/nest-auth-contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IVerify2faRequest } from "@ackplus/nest-auth-contracts";

export class NestAuthVerify2faRequestDto implements IVerify2faRequest {
    @ApiProperty({
        description: 'MFA method used',
        enum: NestAuthMFAMethodEnum,
        example: NestAuthMFAMethodEnum.TOTP,
        enumName: 'NestAuthMFAMethodEnum',
    })
    @IsEnum(NestAuthMFAMethodEnum)
    method: NestAuthMFAMethodEnum;

    @ApiProperty({
        description: 'One-time password code',
        example: '123456',
        minLength: 6,
        maxLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiProperty({
        description: 'Whether to trust this device for future logins',
        example: true,
        required: false,
    })
    rememberDevice?: boolean;
}
