import { IsEnum } from "class-validator";
import { MFAMethodEnum } from "../../../core";
import { ApiProperty } from "@nestjs/swagger";

export class SendMfaCodeRequestDto {
    @ApiProperty({
        description: 'MFA delivery method',
        enum: MFAMethodEnum,
        example: MFAMethodEnum.EMAIL,
        enumName: 'MFAMethodEnum',
        examples: {
            email: { value: MFAMethodEnum.EMAIL, description: 'Send OTP via email' },
            sms: { value: MFAMethodEnum.SMS, description: 'Send OTP via SMS' },
            totp: { value: MFAMethodEnum.TOTP, description: 'Use authenticator app (TOTP)' },
        },
    })
    @IsEnum(MFAMethodEnum)
    method: MFAMethodEnum;
}
