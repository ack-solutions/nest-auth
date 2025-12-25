import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty } from "class-validator";
import { IVerifyTotpSetupRequest } from "@libs/auth-types";

export class VerifyTotpSetupRequestDto implements IVerifyTotpSetupRequest {
    @ApiProperty({
        description: 'The TOTP code from authenticator app',
        example: '123456',
        minLength: 6,
        maxLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    otp: string;

    @ApiProperty({
        description: 'Secret key from TOTP setup',
        example: 'JBSWY3DPEHPK3PXP',
    })
    @IsString()
    @IsNotEmpty()
    secret: string;
}
