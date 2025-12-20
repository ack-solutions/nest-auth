import React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FormField } from '../form/FormField';
import { FormTextarea } from '../form/FormTextarea';
import { FormFooterAction } from '../FormFooter';
import { Plus, Edit2 } from 'lucide-react';

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
    const methods = useForm<TenantFormData>({
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
            methods.reset(initialData);
        }
    }, [initialData, methods]);

    const handleSubmit = async (data: TenantFormData) => {
        try {
            await onSubmit(data);
            methods.reset();
        } catch (err) {
            // Error handled by parent
        }
    };

    const handleCancel = () => {
        methods.reset();
        onCancel();
    };

    const { isSubmitting } = methods.formState;

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
            icon: isEdit ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />,
        },
    ], [handleCancel, isSubmitting, submitLabel, isEdit]);

    // Notify parent of actions
    React.useEffect(() => {
        if (onActionsReady) {
            onActionsReady(footerActions);
        }
    }, [onActionsReady, footerActions]);

    return (
        <FormProvider {...methods}>
            <form id="tenant-form" onSubmit={methods.handleSubmit(handleSubmit)} className="p-4 space-y-3">
                {error && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">{error}</p>
                    </div>
                )}
                <Controller
                    name="name"
                    control={methods.control}
                    render={({ field, fieldState }) => (
                        <FormField
                            id="name"
                            label="Tenant Name"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            error={fieldState.error?.message}
                            placeholder="Acme Corporation"
                            required
                        />
                    )}
                />

                <Controller
                    name="slug"
                    control={methods.control}
                    render={({ field, fieldState }) => (
                        <FormField
                            id="slug"
                            label="Slug"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            error={fieldState.error?.message}
                            placeholder="acme-corp"
                            helpText="URL-friendly identifier (lowercase, hyphens only)"
                            required
                        />
                    )}
                />

                <FormTextarea
                    name="description"
                    label="Description"
                    placeholder="Brief description of this tenant..."
                    rows={2}
                />
            </form>
        </FormProvider>
    );
};
