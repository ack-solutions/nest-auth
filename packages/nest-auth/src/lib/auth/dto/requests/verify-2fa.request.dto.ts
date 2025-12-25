import { IsEnum, IsString, IsNotEmpty } from "class-validator";
import { MFAMethodEnum } from "../../../core";
import { ApiProperty } from "@nestjs/swagger";
import { IVerify2faRequest } from "@libs/auth-types";

export class Verify2faRequestDto implements IVerify2faRequest {
    @ApiProperty({
        description: 'MFA method used',
        enum: MFAMethodEnum,
        example: MFAMethodEnum.TOTP,
        enumName: 'MFAMethodEnum',
    })
    @IsEnum(MFAMethodEnum)
    method: MFAMethodEnum;

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
