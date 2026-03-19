import React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Box, Stack, Typography } from '@mui/material';
import { PasswordRequirements } from '../components/password-requirements';
import { PasswordField } from '../../form/password-field';
import { EmailField } from '../../form/email-field';
import { SecretKeyField } from '../../form/secret-key-field';
import Button from '@mui/material/Button';

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
        <Stack spacing={2}>
            <Box
                sx={{
                    p: 2,
                    bgcolor: 'warning.light',
                    border: '1px solid',
                    borderColor: 'warning.main',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                }}
            >
                <Icon component={AlertCircle} sx={{ fontSize: 20, color: 'warning.main', flexShrink: 0, mt: 0.25 }} />
                <Box sx={{ typography: 'body2', color: 'warning.dark' }}>
                    <Typography variant="body2" fontWeight="600" sx={{ mb: 0.5 }}>Security Required</Typography>
                    <Typography variant="body2">
                        Password reset requires your <strong>Nest Auth Secret Key</strong> configured in{' '}
                        <code>adminConsole.secretKey</code>.
                    </Typography>
                </Box>
            </Box>

            {success && (
                <Box
                    sx={{
                        p: 1.5,
                        bgcolor: 'success.light',
                        border: '1px solid',
                        borderColor: 'success.main',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                    }}
                >
                    <Icon component={Check} sx={{ fontSize: 20, color: 'success.main', flexShrink: 0, mt: 0.25 }} />
                    <Typography variant="body2" color="success.dark">Password reset successfully! You can now sign in with your new password.</Typography>
                </Box>
            )}

            {error && (
                <Box
                    sx={{
                        p: 1.5,
                        bgcolor: 'error.light',
                        border: '1px solid',
                        borderColor: 'error.main',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                    }}
                >
                    <Icon component={AlertCircle} sx={{ fontSize: 20, color: 'error.main', flexShrink: 0, mt: 0.25 }} />
                    <Typography variant="body2" color="error.dark">{error}</Typography>
                </Box>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={2}>
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

                    <Button type="submit" variant="contained" color="primary" disabled={isSubmitting} fullWidth sx={{ py: 1.5 }}>
                        {isSubmitting ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        width: 20,
                                        height: 20,
                                        border: '2px solid',
                                        borderColor: 'primary.contrastText',
                                        borderTopColor: 'transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite',
                                        '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                                    }}
                                />
                                Resetting password...
                            </Box>
                        ) : (
                            'Reset Password'
                        )}
                    </Button>
                </Stack>
            </form>
        </Stack>
    );
};
