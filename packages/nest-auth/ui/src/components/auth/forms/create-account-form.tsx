import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PasswordRequirements } from '../components/password-requirements';
import { RHFEmailField } from '../../form/rhf-email-field';
import { RHFPasswordField } from '../../form/rhf-password-field';
import { RHFSecretKeyField } from '../../form/rhf-secret-key-field';
import { RHFTextField } from '../../form/rhf-text-field';

interface CreateAccountFormData {
    email: string;
    password: string;
    name: string;
    secretKey: string;
}

const createAccountSchema = yup.object({
    email: yup.string().email('Invalid email address').required('Email is required').max(254),
    password: yup
        .string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be less than 128 characters')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/\d/, 'Password must contain at least one number')
        .matches(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)'),
    name: yup.string().max(100, 'Name must be less than 100 characters').optional(),
    secretKey: yup
        .string()
        .required('Secret key is required')
        .min(8, 'Secret key must be at least 8 characters')
        .max(128, 'Secret key must be less than 128 characters'),
});

interface CreateAccountFormProps {
    onSuccess: () => void;
    onError: (error: string) => void;
    error?: string;
    success?: boolean;
    adminApiBaseUrl: string;
}

export const CreateAccountFormComponent: React.FC<CreateAccountFormProps> = ({
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
    } = useForm<CreateAccountFormData>({
        resolver: yupResolver(createAccountSchema) as any,
        defaultValues: {
            email: '',
            password: '',
            name: '',
            secretKey: '',
        },
    });

    const onSubmit = async (data: CreateAccountFormData) => {
        try {
            const response = await fetch(`${adminApiBaseUrl}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: data.email.trim().toLowerCase(),
                    password: data.password,
                    name: data.name.trim() || undefined,
                    secretKey: data.secretKey,
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
                    Secure Access
                </Typography>
                <Typography variant="body2" component="div">
                    Admin accounts can only be created using your <strong>Nest Auth Secret Key</strong> configured in{' '}
                    <code>adminConsole.secretKey</code>. This key is required for admin console security operations.
                </Typography>
            </Alert>

            {success && (
                <Alert severity="success">Admin account created successfully! You can now sign in.</Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <form onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={2}>
                    <RHFSecretKeyField
                        name="secretKey"
                        control={control}
                        id="create-secret-key"
                        label="Nest Auth Secret Key"
                        disabled={isSubmitting}
                        helpText={
                            <>
                                Your Nest Auth secret key configured in <code>adminConsole.secretKey</code> (used for
                                admin console security)
                            </>
                        }
                    />

                    <RHFEmailField
                        name="email"
                        control={control}
                        id="create-email"
                        label="Email Address"
                        disabled={isSubmitting}
                        autoComplete="username"
                        required
                    />

                    <RHFTextField
                        name="name"
                        control={control}
                        id="create-name"
                        label="Name (Optional)"
                        disabled={isSubmitting}
                        placeholder="Admin User"
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PersonOutlineIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />

                    <RHFPasswordField
                        name="password"
                        control={control}
                        id="create-password"
                        label="Password"
                        disabled={isSubmitting}
                        showGenerateButton={true}
                        showStrengthIndicator={true}
                    />

                    <PasswordRequirements />

                    <Box >
                        <Button
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
                                    <span>Creating account...</span>
                                </Stack>
                            ) : (
                                'Create Admin Account'
                            )}
                        </Button>
                    </Box>
                </Stack>
            </form>
        </Stack>
    );
};
