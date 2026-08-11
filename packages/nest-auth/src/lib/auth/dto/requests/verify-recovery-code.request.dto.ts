import { IsString, IsNotEmpty, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { IVerifyRecoveryCodeRequest } from "@ackplus/nest-auth-contracts";

export class NestAuthVerifyRecoveryCodeRequestDto implements IVerifyRecoveryCodeRequest {
    @ApiProperty({
        description: 'A single-use MFA recovery (backup) code',
        example: 'aZ8xK2m9Qp',
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({
        description: 'Whether to trust this device for future logins',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    trustDevice?: boolean;
}
