import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Box, Paper, Typography, Stack, Divider } from '@mui/material';
import { PasswordField } from '../../form/password-field';
import { EmailField } from '../../form/email-field';
import Button from '@mui/material/Button';
import type { LoginForm } from '../types';

const loginSchema = yup.object({
    email: yup.string().email('Invalid email address').required('Email is required'),
    password: yup.string().required('Password is required'),
});

interface LoginFormProps {
    onSubmit: (credentials: LoginForm) => Promise<void>;
    error?: string | null;
    onOpenCreateAccount: () => void;
    onOpenForgotPassword: () => void;
}

export const LoginFormComponent: React.FC<LoginFormProps> = ({
    onSubmit: onSubmitProp,
    error: externalError,
    onOpenCreateAccount,
    onOpenForgotPassword,
}) => {
    const [internalError, setInternalError] = useState('');

    const {
        control,
        handleSubmit,
        formState: { isSubmitting },
        reset,
    } = useForm<LoginForm>({
        resolver: yupResolver(loginSchema) as any,
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (data: LoginForm) => {
        try {
            setInternalError('');
            await onSubmitProp({
                email: data.email.trim().toLowerCase(),
                password: data.password,
            });
            reset();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
            setInternalError(errorMessage);
        }
    };

    const error = externalError || internalError;

    return (
        <Paper elevation={8} sx={{ borderRadius: 2, p: 3 }}>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                    Welcome back
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Sign in to your admin account
                </Typography>
            </Box>

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
                        mb: 2,
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
                                id="email"
                                label="Email Address"
                                value={field.value}
                                onChange={field.onChange}
                                disabled={isSubmitting}
                                placeholder="admin@example.com"
                                autoComplete="username"
                            />
                        )}
                    />

                    <Box>
                        <Controller
                            name="password"
                            control={control}
                            render={({ field }) => (
                                <PasswordField
                                    id="password"
                                    label="Password"
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={isSubmitting}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            )}
                        />
                        <Box sx={{ mt: 1, textAlign: 'right' }}>
                            <Button
                                type="button"
                                variant="text"
                                size="small"
                                onClick={onOpenForgotPassword}
                                sx={{ color: 'primary.main', '&:hover': { color: 'primary.dark' } }}
                            >
                                Forgot password?
                            </Button>
                        </Box>
                    </Box>

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
                                Signing in...
                            </Box>
                        ) : (
                            'Sign In'
                        )}
                    </Button>
                </Stack>
            </form>

            <Box sx={{ mt: 3 }}>
                <Box sx={{ position: 'relative', py: 1 }}>
                    <Divider />
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            px: 1,
                            bgcolor: 'background.paper',
                        }}
                    >
                        New to this app?
                    </Typography>
                </Box>

                <Button
                    type="button"
                    variant="outlined"
                    color="inherit"
                    fullWidth
                    sx={{ mt: 2, py: 1.5 }}
                    onClick={onOpenCreateAccount}
                >
                    Create Admin Account
                </Button>
            </Box>
        </Paper>
    );
};
