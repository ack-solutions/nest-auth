/**
 * Password Types
 * Password reset and change types
 */

export interface IForgotPasswordRequest {
    email?: string;
    phone?: string;
}

export interface IResetPasswordRequest {
    otp: string;
    newPassword: string;
}

export interface IResetPasswordWithTokenRequest {
    token: string;
    newPassword: string;
}

export interface IChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface IVerifyForgotPasswordOtpRequest {
    email?: string;
    phone?: string;
    otp: string;
    tenantId?: string;
}

export interface IVerifyOtpResponse {
    message: string;
    resetToken?: string;
    token?: string;
}
