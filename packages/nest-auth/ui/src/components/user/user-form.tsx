import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Box, Stack, Typography } from '@mui/material';
import { RHFEmailField } from '../form/rhf-email-field';
import { RHFSelect } from '../form/rhf-select';
import { FormFooterAction } from '../form-footer';
import { Plus } from 'lucide-react';
import Icon from '@mui/material/Icon';
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
        formState: { isSubmitting },
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
                icon: <Icon component={Plus} />,
            },
        ],
        [handleCancel, isSubmitting, submitLabel]
    );

    React.useEffect(() => {
        onActionsReady?.(footerActions);
    }, [onActionsReady, footerActions]);

    return (
        <form id="user-form" onSubmit={handleSubmit(handleFormSubmit)}>
            <Stack spacing={1.5} sx={{ p: 2 }}>
                {error && (
                    <Box sx={{ p: 1.5, bgcolor: 'error.light', border: '1px solid', borderColor: 'error.main', borderRadius: 1 }}>
                        <Typography variant="caption" color="error.dark">{error}</Typography>
                    </Box>
                )}

                <RHFEmailField
                    name="email"
                    control={control}
                    id="user-email"
                    label="Email Address"
                    disabled={isSubmitting}
                    placeholder="user@example.com"
                />

                {isIsolated && (
                    <RHFSelect
                        name="tenantId"
                        control={control}
                        label="Tenant"
                        options={[
                            { value: '', label: 'Select tenant...' },
                            ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` })),
                        ]}
                        placeholder="Select tenant..."
                        required
                        disabled={isSubmitting}
                    />
                )}

                {tenantMode === 'shared' && (
                    <Typography variant="caption" color="text.secondary">
                        Tenant and roles can be assigned when editing the user after creation.
                    </Typography>
                )}
            </Stack>
        </form>
    );
};
