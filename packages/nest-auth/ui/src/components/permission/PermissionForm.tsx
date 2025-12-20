import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FormField } from '../form/FormField';
import { FormFooterAction } from '../FormFooter';
import { Plus, Edit2 } from 'lucide-react';

export interface PermissionFormData {
    name: string;
    guard: string;
    description?: string;
    category?: string;
    updateInRoles?: boolean;
}

const permissionSchema = yup.object({
    name: yup.string().required('Permission name is required').min(1, 'Permission name cannot be empty'),
    guard: yup.string().required('Guard is required').min(1, 'Guard cannot be empty'),
    description: yup.string().optional(),
    category: yup.string().optional(),
    updateInRoles: yup.boolean().optional(),
});

export interface PermissionFormProps {
    initialData?: Partial<PermissionFormData>;
    categories: string[];
    onSubmit: (data: PermissionFormData) => Promise<void>;
    onCancel: () => void;
    error?: string;
    submitLabel?: string;
    isEdit?: boolean;
    originalName?: string;
    onActionsReady?: (actions: FormFooterAction[]) => void;
}

export const PermissionForm: React.FC<PermissionFormProps> = ({
    initialData,
    categories,
    onSubmit,
    onCancel,
    error,
    submitLabel,
    isEdit = false,
    originalName,
    onActionsReady,
}) => {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        watch,
    } = useForm<PermissionFormData>({
        resolver: yupResolver(permissionSchema) as any,
        defaultValues: initialData || {
            name: '',
            guard: 'web',
            description: '',
            category: '',
            updateInRoles: false,
        },
    });

    const name = watch('name');
    const nameChanged = isEdit && name.trim() !== (originalName || '');

    // Reset form when initialData changes (for edit mode)
    React.useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

    const handleFormSubmit = async (data: PermissionFormData) => {
        try {
            await onSubmit(data);
            if (!isEdit) {
                reset();
            }
        } catch (err) {
            // Error handled by parent
        }
    };

    const handleCancel = () => {
        if (!isEdit) {
            reset();
        }
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
            label: submitLabel || (isEdit ? 'Update Permission' : 'Create Permission'),
            onClick: () => {
                const form = document.getElementById('permission-form') as HTMLFormElement;
                if (form) {
                    form.requestSubmit();
                }
            },
            variant: 'primary' as const,
            disabled: isSubmitting,
            icon: isEdit ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />,
        },
    ], [handleCancel, isSubmitting, isEdit, submitLabel]);

    // Notify parent of actions
    React.useEffect(() => {
        if (onActionsReady) {
            onActionsReady(footerActions);
        }
    }, [onActionsReady, footerActions]);

    return (
        <form id="permission-form" onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600">{error}</p>
                </div>
            )}

            <Controller
                name="name"
                control={control}
                render={({ field }) => (
                    <div>
                        <FormField
                            id="perm-name"
                            label="Permission Name"
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                            error={errors.name?.message}
                            placeholder="users.create, posts.edit, admin.access..."
                            startIcon={null}
                            helpText="Use dot notation for clarity (e.g., resource.action)"
                        />
                        {nameChanged && (
                            <div className="mt-1.5 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <Controller
                                    name="updateInRoles"
                                    control={control}
                                    render={({ field: checkboxField }) => (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={checkboxField.value || false}
                                                onChange={(e) => checkboxField.onChange(e.target.checked)}
                                                className="rounded"
                                                disabled={isSubmitting}
                                            />
                                            <span className="text-xs text-yellow-900">
                                                Update this permission name in all roles that use it ({originalName} → {name.trim()})
                                            </span>
                                        </label>
                                    )}
                                />
                            </div>
                        )}
                    </div>
                )}
            />

            <Controller
                name="guard"
                control={control}
                render={({ field }) => (
                    <FormField
                        id="perm-guard"
                        label="Guard"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                        error={errors.guard?.message}
                        placeholder="web, api, admin..."
                        startIcon={null}
                        helpText="Guard determines which authentication context this permission applies to"
                    />
                )}
            />

            <Controller
                name="description"
                control={control}
                render={({ field }) => (
                    <div>
                        <label htmlFor="perm-description" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Description (Optional)
                        </label>
                        <textarea
                            id="perm-description"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            className="input-field"
                            placeholder="What does this permission allow?"
                            rows={2}
                            disabled={isSubmitting}
                        />
                        {errors.description && (
                            <p className="text-xs text-red-600 mt-0.5">{errors.description.message}</p>
                        )}
                    </div>
                )}
            />

            <Controller
                name="category"
                control={control}
                render={({ field }) => (
                    <div>
                        <FormField
                            id="perm-category"
                            label="Category (Optional)"
                            value={field.value || ''}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                            error={errors.category?.message}
                            placeholder="users, posts, admin, etc."
                            startIcon={null}
                        />
                        <datalist id="category-suggestions">
                            {categories.map((cat) => (
                                <option key={cat} value={cat} />
                            ))}
                        </datalist>
                    </div>
                )}
            />

            {isEdit && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 mb-0.5">Note</p>
                    <p className="text-xs text-blue-800">
                        {nameChanged
                            ? 'If you check "Update in roles", this permission name will be updated in all roles that currently use it. Otherwise, roles will continue to use the old permission name.'
                            : 'Roles store permission names as JSON strings, so they remain independent of this registry. If you change the permission name, you can optionally update it in all roles.'}
                    </p>
                </div>
            )}
        </form>
    );
};
