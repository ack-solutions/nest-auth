import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { PasswordField } from '../../form/PasswordField';
import { EmailField } from '../../form/EmailField';
import { SecretKeyField } from '../../form/SecretKeyField';

interface ResetPasswordFormData {
    email: string;
    secretKey: string;
    newPassword: string;
}

const resetPasswordSchema = yup.object({
    email: yup.string().email('Invalid email address').required('Email is required').max(254),
    secretKey: yup
        .string()
        .required('Secret key is required')
        .min(8, 'Secret key must be at least 8 characters')
        .max(128, 'Secret key must be less than 128 characters'),
    newPassword: yup
        .string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be less than 128 characters')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/\d/, 'Password must contain at least one number')
        .matches(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)'),
});

interface ResetPasswordFormProps {
    onSuccess: () => void;
    onError: (error: string) => void;
    error?: string;
    success?: boolean;
    adminApiBaseUrl: string;
}

export const ResetPasswordFormComponent: React.FC<ResetPasswordFormProps> = ({
    onSuccess,
    onError,
    error,
    success,
    adminApiBaseUrl,
}) => {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<ResetPasswordFormData>({
        resolver: yupResolver(resetPasswordSchema) as any,
        defaultValues: {
            email: '',
            secretKey: '',
            newPassword: '',
        },
    });

    const onSubmit = async (data: ResetPasswordFormData) => {
        try {
            const response = await fetch(`${adminApiBaseUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: data.email.trim().toLowerCase(),
                    secretKey: data.secretKey,
                    newPassword: data.newPassword,
                }),
            });

            let responseData: any = {};
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    responseData = await response.json();
                } catch {
                    // Ignore JSON parse errors
                }
            }

            if (!response.ok) {
                const errorMessage =
                    responseData.message ||
                    responseData.error ||
                    `Request failed with status ${response.status}`;
                throw new Error(errorMessage);
            }

            reset();
            onSuccess();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
            onError(errorMessage);
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Security Required</p>
                    <p>
                        Password reset requires your <strong>Nest Auth Secret Key</strong> configured in{' '}
                        <code>adminConsole.secretKey</code>.
                    </p>
                </div>
            </div>

            {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-600">Password reset successfully! You can now sign in with your new password.</p>
                </div>
            )}

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                        <EmailField
                            id="reset-email"
                            label="Email Address *"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                            error={errors.email?.message}
                            autoComplete="username"
                        />
                    )}
                />

                <Controller
                    name="secretKey"
                    control={control}
                    render={({ field }) => (
                        <SecretKeyField
                            id="reset-secret-key"
                            label="Nest Auth Secret Key *"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                            error={errors.secretKey?.message}
                            helpText={
                                !errors.secretKey ? (
                                    <>
                                        Your Nest Auth secret key configured in <code>adminConsole.secretKey</code>{' '}
                                        (used for admin console security)
                                    </>
                                ) : undefined
                            }
                        />
                    )}
                />

                <Controller
                    name="newPassword"
                    control={control}
                    render={({ field }) => (
                        <PasswordField
                            id="reset-new-password"
                            label="New Password *"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                            error={errors.newPassword?.message}
                            showGenerateButton={true}
                            showStrengthIndicator={true}
                        />
                    )}
                />

                <PasswordRequirements />

                <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-3 text-base">
                    {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            Resetting password...
                        </span>
                    ) : (
                        'Reset Password'
                    )}
                </button>
            </form>
        </div>
    );
};
