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
import { RHFEmailField } from '../../form/rhf-email-field';
import { RHFPasswordField } from '../../form/rhf-password-field';
import { RHFSecretKeyField } from '../../form/rhf-secret-key-field';

const RESET_PASSWORD_FORM_ID = 'nest-auth-reset-password-form';

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
        formState: { isSubmitting },
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

            <form id={RESET_PASSWORD_FORM_ID} onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={2}>
                    <RHFEmailField
                        name="email"
                        control={control}
                        id="reset-email"
                        label="Email Address"
                        disabled={isSubmitting}
                        autoComplete="username"
                        required
                    />

                    <RHFSecretKeyField
                        name="secretKey"
                        control={control}
                        id="reset-secret-key"
                        label="Nest Auth Secret Key"
                        disabled={isSubmitting}
                        helpText={
                            <>
                                Your Nest Auth secret key configured in <code>adminConsole.secretKey</code> (used for
                                admin console security)
                            </>
                        }
                    />

                    <RHFPasswordField
                        name="newPassword"
                        control={control}
                        id="reset-new-password"
                        label="New Password"
                        disabled={isSubmitting}
                        showGenerateButton={true}
                        showStrengthIndicator={true}
                    />

                    <PasswordRequirements />
                </Stack>
            </form>

            <Box
                sx={{
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 2,
                    pt: 2,
                    mt: 1,
                    mx: -2,
                    px: 2,
                    pb: 0,
                    mb: -2,
                    bgcolor: 'background.paper',
                    borderTop: 1,
                    borderColor: 'divider',
                }}
            >
                <Button
                    form={RESET_PASSWORD_FORM_ID}
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    fullWidth
                    sx={{ py: 1.5 }}
                >
                    {isSubmitting ? (
                        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                            <CircularProgress size={20} color="inherit" />
                            <span>Resetting password...</span>
                        </Stack>
                    ) : (
                        'Reset Password'
                    )}
                </Button>
            </Box>
        </Stack>
    );
};
