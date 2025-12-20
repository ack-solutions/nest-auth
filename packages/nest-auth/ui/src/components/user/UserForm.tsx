import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { EmailField } from '../form/EmailField';
import { Select } from '../Select';
import { MultiSelect } from '../MultiSelect';
import { PasswordField } from '../form/PasswordField';
import { FormFooterAction } from '../FormFooter';
import { Plus } from 'lucide-react';
import type { Tenant, Role } from '../../types';

export interface UserFormData {
    email: string;
    tenantId: string;
    password: string;
    roles: string[];
}

const userSchema = yup.object({
    email: yup.string().email('Invalid email address').required('Email is required'),
    tenantId: yup.string().required('Tenant is required'),
    password: yup.string().required('Password is required').min(8, 'Password must be at least 8 characters'),
    roles: yup.array().of(yup.string()).default([]),
});

export interface UserFormProps {
    initialData?: Partial<UserFormData>;
    tenants: Tenant[];
    roles: Role[];
    onSubmit: (data: UserFormData) => Promise<void>;
    onCancel: () => void;
    error?: string;
    submitLabel?: string;
    onActionsReady?: (actions: FormFooterAction[]) => void;
}

export const UserForm: React.FC<UserFormProps> = ({
    initialData,
    tenants,
    roles,
    onSubmit,
    onCancel,
    error,
    submitLabel = 'Create User',
    onActionsReady,
}) => {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<UserFormData>({
        resolver: yupResolver(userSchema) as any,
        defaultValues: initialData || {
            email: '',
            tenantId: '',
            password: '',
            roles: [],
        },
    });

    const handleFormSubmit = async (data: UserFormData) => {
        try {
            await onSubmit(data);
            reset();
        } catch (err) {
            // Error handled by parent
        }
    };

    const handleCancel = () => {
        reset();
        onCancel();
    };

    // Prepare footer actions
    const footerActions: FormFooterAction[] = React.useMemo(() => [
        {
            label: 'Cancel',
            onClick: handleCancel,
            variant: 'secondary' as const,
            disabled: isSubmitting,
        },
        {
            label: submitLabel,
            onClick: () => {
                const form = document.getElementById('user-form') as HTMLFormElement;
                if (form) {
                    form.requestSubmit();
                }
            },
            variant: 'primary' as const,
            disabled: isSubmitting,
            icon: <Plus className="w-4 h-4" />,
        },
    ], [handleCancel, isSubmitting, submitLabel]);

    // Notify parent of actions
    React.useEffect(() => {
        if (onActionsReady) {
            onActionsReady(footerActions);
        }
    }, [onActionsReady, footerActions]);

    return (
        <form id="user-form" onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600">{error}</p>
                </div>
            )}

            <Controller
                name="email"
                control={control}
                render={({ field }) => (
                    <EmailField
                        id="user-email"
                        label="Email Address"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                        error={errors.email?.message}
                        placeholder="user@example.com"
                    />
                )}
            />

            <div>
                <Controller
                    name="tenantId"
                    control={control}
                    render={({ field }) => (
                        <Select
                            label="Tenant"
                            value={field.value}
                            onChange={field.onChange}
                            options={tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` }))}
                            placeholder="Select a tenant..."
                            required
                        />
                    )}
                />
                {errors.tenantId && (
                    <p className="text-xs text-red-600 mt-0.5">{errors.tenantId.message}</p>
                )}
            </div>

            <Controller
                name="password"
                control={control}
                render={({ field }) => (
                    <PasswordField
                        id="user-password"
                        label="Password"
                        value={field.value || ''}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                        error={errors.password?.message}
                        placeholder="Enter password"
                        showGenerateButton={true}
                        showStrengthIndicator={true}
                    />
                )}
            />

            <div>
                <Controller
                    name="roles"
                    control={control}
                    render={({ field }) => (
                        <MultiSelect
                            label="Roles"
                            value={field.value || []}
                            onChange={field.onChange}
                            options={roles.map((r) => ({
                                value: r.name,
                                label: r.tenantId ? `${r.name} (${r.guard})` : `${r.name} (${r.guard}) - Global`,
                            }))}
                            placeholder="Select roles..."
                        />
                    )}
                />
                {errors.roles && (
                    <p className="text-xs text-red-600 mt-0.5">{errors.roles.message}</p>
                )}
            </div>
        </form>
    );
};
