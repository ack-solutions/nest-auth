import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { EmailField } from '../form/EmailField';
import { Select } from '../Select';
import { FormFooterAction } from '../FormFooter';
import { Plus } from 'lucide-react';
import type { Tenant, Role } from '../../types';

/** Create user form data: shared = email only; isolated = email + tenantId. */
export interface UserFormData {
    email: string;
    tenantId?: string;
}

const makeSchema = (requireTenantId: boolean) =>
    yup.object({
        email: yup.string().email('Invalid email address').required('Email is required'),
        tenantId: requireTenantId
            ? yup.string().required('Tenant is required')
            : yup.string().optional(),
    });

export type TenantMode = 'isolated' | 'shared' | null;

export interface UserFormProps {
    initialData?: Partial<UserFormData>;
    tenantMode: TenantMode;
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
    tenantMode,
    tenants,
    roles,
    onSubmit,
    onCancel,
    error,
    submitLabel = 'Create User',
    onActionsReady,
}) => {
    const isIsolated = tenantMode === 'isolated';
    const schema = React.useMemo(() => makeSchema(isIsolated), [isIsolated]);

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<UserFormData>({
        resolver: yupResolver(schema) as any,
        defaultValues: initialData || {
            email: '',
            tenantId: '',
        },
    });

    const handleFormSubmit = async (data: UserFormData) => {
        try {
            await onSubmit(data);
            reset();
        } catch {
            // Error handled by parent
        }
    };

    const handleCancel = React.useCallback(() => {
        reset();
        onCancel();
    }, [reset, onCancel]);

    const footerActions: FormFooterAction[] = React.useMemo(
        () => [
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
                    if (form) form.requestSubmit();
                },
                variant: 'primary' as const,
                disabled: isSubmitting,
                icon: <Plus className="w-4 h-4" />,
            },
        ],
        [handleCancel, isSubmitting, submitLabel]
    );

    React.useEffect(() => {
        onActionsReady?.(footerActions);
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

            {isIsolated && (
                <div>
                    <Controller
                        name="tenantId"
                        control={control}
                        render={({ field }) => (
                            <Select
                                label="Tenant"
                                value={field.value || ''}
                                onChange={field.onChange}
                                options={[
                                    { value: '', label: 'Select tenant...' },
                                    ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` })),
                                ]}
                                placeholder="Select tenant..."
                                required={true}
                            />
                        )}
                    />
                    {errors.tenantId && (
                        <p className="text-xs text-red-600 mt-0.5">{errors.tenantId.message}</p>
                    )}
                </div>
            )}

            {tenantMode === 'shared' && (
                <p className="text-xs text-gray-500">
                    Tenant and roles can be assigned when editing the user after creation.
                </p>
            )}
        </form>
    );
};
