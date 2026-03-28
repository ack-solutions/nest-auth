import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Typography } from '@mui/material';
import { RHFTextField } from '../form/rhf-text-field';
import { FormFooterAction } from '../form-footer';
import { Plus, Pencil } from 'lucide-react';
import Icon from '@mui/material/Icon';

export interface TenantFormData {
    name: string;
    slug: string;
    description?: string;
}

const tenantSchema = yup.object({
    name: yup.string().required('Tenant name is required').min(1, 'Tenant name cannot be empty'),
    slug: yup
        .string()
        .required('Slug is required')
        .matches(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
        .min(1, 'Slug cannot be empty'),
    description: yup.string().optional(),
});

export interface TenantFormProps {
    initialData?: Partial<TenantFormData>;
    onSubmit: (data: TenantFormData) => Promise<void>;
    onCancel: () => void;
    error?: string;
    submitLabel?: string;
    isEdit?: boolean;
    onActionsReady?: (actions: FormFooterAction[]) => void;
}

export const TenantForm: React.FC<TenantFormProps> = ({
    initialData,
    onSubmit,
    onCancel,
    error,
    submitLabel = 'Create Tenant',
    isEdit = false,
    onActionsReady,
}) => {
    const {
        control,
        handleSubmit,
        formState: { isSubmitting },
        reset,
    } = useForm<TenantFormData>({
        resolver: yupResolver(tenantSchema) as any,
        defaultValues: initialData || {
            name: '',
            slug: '',
            description: '',
        },
    });

    // Reset form when initialData changes (for edit mode)
    React.useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

    const handleSubmitForm = async (data: TenantFormData) => {
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
            label: isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : submitLabel,
            onClick: () => {
                const form = document.getElementById('tenant-form') as HTMLFormElement;
                if (form) {
                    form.requestSubmit();
                }
            },
            variant: 'primary' as const,
            disabled: isSubmitting,
            icon: isEdit ? <Icon component={Pencil} /> : <Icon component={Plus} />,
        },
    ], [handleCancel, isSubmitting, submitLabel, isEdit]);

    // Notify parent of actions
    React.useEffect(() => {
        if (onActionsReady) {
            onActionsReady(footerActions);
        }
    }, [onActionsReady, footerActions]);

    return (
        <form id="tenant-form" onSubmit={handleSubmit(handleSubmitForm)} className="p-4 space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <Typography variant="caption" color="error">{error}</Typography>
                </div>
            )}
            <RHFTextField
                name="name"
                control={control}
                id="name"
                label="Tenant Name"
                placeholder="Acme Corporation"
                required
            />

            <RHFTextField
                name="slug"
                control={control}
                id="slug"
                label="Slug"
                placeholder="acme-corp"
                helperText="URL-friendly identifier (lowercase, hyphens only)"
                required
            />

            <RHFTextField
                name="description"
                control={control}
                id="description"
                label="Description"
                placeholder="Brief description of this tenant..."
                multiline
                minRows={2}
            />
        </form>
    );
};
