import React from 'react';
import { User, AlertCircle, Check } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { PasswordField } from '../../form/PasswordField';
import { EmailField } from '../../form/EmailField';
import { SecretKeyField } from '../../form/SecretKeyField';
import { FormField } from '../../form/FormField';

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
        formState: { errors, isSubmitting },
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
        <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Secure Access</p>
                    <p>
                        Admin accounts can only be created using your <strong>Nest Auth Secret Key</strong> configured
                        in <code>adminConsole.secretKey</code>. This key is required for admin console security operations.
                    </p>
                </div>
            </div>

            {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-600">Admin account created successfully! You can now sign in.</p>
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
                    name="secretKey"
                    control={control}
                    render={({ field }) => (
                        <SecretKeyField
                            id="create-secret-key"
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
                    name="email"
                    control={control}
                    render={({ field }) => (
                        <EmailField
                            id="create-email"
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
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <FormField
                            startIcon={<User className="h-5 w-5 text-gray-400" />}
                            label="Name (Optional)"
                            id="create-name"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                            placeholder="Admin User"
                            error={errors.name?.message}
                        />
                    )}
                />


                <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                        <PasswordField
                            id="create-password"
                            label="Password *"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                            error={errors.password?.message}
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
                            Creating account...
                        </span>
                    ) : (
                        'Create Admin Account'
                    )}
                </button>
            </form>
        </div>
    );
};
