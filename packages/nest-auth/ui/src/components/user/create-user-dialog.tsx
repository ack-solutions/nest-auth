import React, { useState } from 'react';
import { FormDialog } from '../form-dialog';
import type { Tenant, Role } from '../../types';
import { RHFSelect } from '../form/hook-form-fields/rhf-select';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Stack, Typography } from '@mui/material';
import { RHFTextField } from '../form';

export interface CreateUserDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: UserFormData) => Promise<void>;
    tenantMode: TenantMode;
    tenants: Tenant[];
    roles: Role[];
    error?: string;
}


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


export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
    open,
    onClose,
    onSubmit,
    tenantMode,
    tenants,
    roles,
    error,
}) => {
    const isIsolated = tenantMode === 'isolated';
    const schema = React.useMemo(() => makeSchema(isIsolated), [isIsolated]);

    const methods = useForm<UserFormData>({
        resolver: yupResolver(schema) as any,
        defaultValues: {
            email: '',
            tenantId: '',
        },
    });

    const handleFormSubmit = async (data: UserFormData) => {
        try {
            await onSubmit(data);
            methods.reset();
        } catch {
            // Error handled by parent
        }
    };

    return (
        <FormDialog
            formContext={methods}
            open={open}
            onClose={onClose}
            title="Create New User"
            maxWidth="md"
        >
            <Stack spacing={1.5} sx={{ p: 2 }}>
                <RHFTextField
                    name="email"
                    label="Email Address"
                    disabled={methods.formState.isSubmitting}
                    placeholder="user@example.com"
                />

                {isIsolated && (
                    <RHFSelect
                        name="tenantId"
                         label="Tenant"
                        options={[
                            { value: '', label: 'Select tenant...' },
                            ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` })),
                        ]}
                        placeholder="Select tenant..."
                        required
                        disabled={methods.formState.isSubmitting}
                    />
                )}

                {tenantMode === 'shared' && (
                    <Typography variant="body2" color="text.secondary">
                        Tenant and roles can be assigned when editing the user after creation.
                    </Typography>
                )}
            </Stack>
        </FormDialog>
    );
};
