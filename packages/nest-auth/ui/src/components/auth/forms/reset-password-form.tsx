import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PasswordRequirements } from '../components/password-requirements';
import { RHFPasswordField } from '../../form/hook-form-fields/rhf-password-field';
import { RHFTextField } from '../../form/hook-form-fields/rhf-text-field';
import { FormContainer } from '@/components/form/form-container';

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
    const methods = useForm<ResetPasswordFormData>({
        resolver: yupResolver(resetPasswordSchema) as any,
        defaultValues: {
            email: '',
            secretKey: '',
            newPassword: '',
        },
    });

    const {
        formState: { isSubmitting },
        reset,
    } = methods;

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
            <Alert severity="warning" sx={{ alignItems: 'flex-start' }}>
                <Typography variant="body2" fontWeight={600} component="div" gutterBottom>
                    Security Required
                </Typography>
                <Typography variant="body2" component="div">
                    Password reset requires your <strong>Nest Auth Secret Key</strong> configured in{' '}
                    <code>adminConsole.secretKey</code>.
                </Typography>
            </Alert>

            {success && (
                <Alert severity="success">
                    Password reset successfully! You can now sign in with your new password.
                </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <FormContainer formContext={methods} onSuccess={onSubmit}>
                <Stack spacing={2}>
                    <RHFTextField
                        name="email"
                        id="reset-email"
                        label="Email Address"
                        disabled={isSubmitting}
                        autoComplete="username"
                        required
                    />

                    <RHFTextField
                        name="secretKey"
                        id="reset-secret-key"
                        label="Nest Auth Secret Key"
                        disabled={isSubmitting}
                        helperText={
                            <>
                                Your Nest Auth secret key configured in <code>adminConsole.secretKey</code> (used for
                                admin console security)
                            </>
                        }
                    />

                    <RHFPasswordField
                        name="newPassword"
                        id="reset-new-password"
                        label="New Password"
                        disabled={isSubmitting}
                        showGenerateButton={true}
                        showStrengthIndicator={true}
                    />

                    <PasswordRequirements />
                </Stack>
            </FormContainer>

            <Box
            >
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    fullWidth
                    loading={isSubmitting}
                >
                    {isSubmitting ? 'Resetting password...' : 'Reset Password'}
                </Button>
            </Box>
        </Stack>
    );
};
