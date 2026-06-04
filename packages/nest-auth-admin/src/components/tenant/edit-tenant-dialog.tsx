import React, { useCallback, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import type { SubmitErrorHandler } from 'react-hook-form';
import { FormDialog } from '../form-dialog';
import { RHFTextField } from '../form/hook-form-fields/rhf-text-field';
import { tenantSchema, type TenantFormData } from './tenant-form-schema';
import type { Tenant } from '../../types';
import { Button } from '@mui/material';

export interface EditTenantDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: TenantFormData) => Promise<void>;
    tenant: Tenant;
    error?: string;
    onError?: SubmitErrorHandler<TenantFormData>;
}

const FORM_ID = 'edit-tenant-form';

export const EditTenantDialog: React.FC<EditTenantDialogProps> = ({
    open,
    onClose,
    onSubmit,
    tenant,
    error,
    onError,
}) => {
    const methods = useForm<TenantFormData, unknown, TenantFormData>({
        resolver: yupResolver(tenantSchema) as any,
        defaultValues: {
            name: tenant.name,
            slug: tenant.slug,
            description: tenant.description || '',
        },
    });

    const {
        reset,
        formState: { isSubmitting },
    } = methods;

    useEffect(() => {
        if (open) {
            reset({
                name: tenant.name,
                slug: tenant.slug,
                description: tenant.description || '',
            });
        }
    }, [open, tenant, reset]);

    const handleSuccess = async (data: TenantFormData) => {
        await onSubmit(data);
    };

    const handleCancel = useCallback(() => {
        reset({
            name: tenant.name,
            slug: tenant.slug,
            description: tenant.description || '',
        });
        onClose();
    }, [reset, tenant, onClose]);


    return (
        <FormDialog
            formContext={methods}
            onSuccess={handleSuccess}
            onError={onError}
            open={open}
            onClose={onClose}
            title="Edit Tenant"
            subTitle="Update tenant name, slug, and description"
            icon={<Icon component={Building2} sx={{ color: 'primary.main' }} />}
            maxWidth="md"
            actions={
                <>
                    <Button onClick={handleCancel} type="button" variant="outlined">Cancel</Button>
                    <Button type="submit" variant="contained" loading={isSubmitting}>Update Tenant</Button>
                </>
            }
        >
            <Stack spacing={2} sx={{ p: 2 }}>
                {error && (
                    <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                        {error}
                    </Alert>
                )}
                <RHFTextField name="name" id="edit-tenant-name" label="Tenant Name" placeholder="Acme Corporation" required fullWidth />
                <RHFTextField
                    name="slug"
                    id="edit-tenant-slug"
                    label="Slug"
                    placeholder="acme-corp"
                    helperText="URL-friendly identifier (lowercase, hyphens only)"
                    required
                    fullWidth
                />
                <RHFTextField
                    name="description"
                    id="edit-tenant-description"
                    label="Description"
                    placeholder="Brief description of this tenant..."
                    multiline
                    minRows={2}
                    fullWidth
                />
            </Stack>
        </FormDialog>
    );
};
