import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { PasswordField } from '../../form/PasswordField';
import { EmailField } from '../../form/EmailField';
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
        <div className="bg-white rounded-xl shadow-2xl p-8 animate-slide-up">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
                <p className="text-gray-600 mt-1">Sign in to your admin account</p>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

                <div>
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
                    <div className="mt-2 text-right">
                        <button
                            type="button"
                            onClick={onOpenForgotPassword}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                            Forgot password?
                        </button>
                    </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-3 text-base">
                    {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            Signing in...
                        </span>
                    ) : (
                        'Sign In'
                    )}
                </button>
            </form>

            <div className="mt-6">
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">New to this app?</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onOpenCreateAccount}
                    className="mt-4 w-full btn-secondary py-3 text-base"
                >
                    Create Admin Account
                </button>
            </div>
        </div>
    );
};
