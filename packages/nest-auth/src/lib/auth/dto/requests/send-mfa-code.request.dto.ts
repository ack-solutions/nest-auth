
import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ISendMfaCodeRequest } from "@ackplus/nest-auth-contracts";
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-contracts';

export class NestAuthSendMfaCodeRequestDto implements ISendMfaCodeRequest {
    @ApiProperty({
        description: 'MFA delivery method',
        enum: NestAuthMFAMethodEnum,
        example: NestAuthMFAMethodEnum.EMAIL,
        enumName: 'NestAuthMFAMethodEnum',
        examples: {
            email: { value: NestAuthMFAMethodEnum.EMAIL, description: 'Send OTP via email' },
            sms: { value: NestAuthMFAMethodEnum.SMS, description: 'Send OTP via SMS' },
            totp: { value: NestAuthMFAMethodEnum.TOTP, description: 'Use authenticator app (TOTP)' },
        },
    })
    @IsEnum(NestAuthMFAMethodEnum)
    method: NestAuthMFAMethodEnum;
}
