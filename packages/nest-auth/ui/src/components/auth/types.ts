export interface LoginForm {
    email: string;
    password: string;
}

export interface CreateAccountForm {
    email: string;
    password: string;
    name: string;
    secretKey: string; // Backend field name - UI displays as "Nest Auth Secret Key"
}

export interface ResetPasswordForm {
    email: string;
    secretKey: string; // Backend field name - UI displays as "Nest Auth Secret Key"
    newPassword: string;
}
