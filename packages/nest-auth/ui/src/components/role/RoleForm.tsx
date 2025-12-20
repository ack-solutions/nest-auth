import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FormField } from '../form/FormField';
import { Select } from '../Select';
import { PermissionInput } from '../PermissionInput';
import { FormFooterAction } from '../FormFooter';
import { Plus, Edit2 } from 'lucide-react';
import type { Tenant } from '../../types';

export interface RoleFormData {
    name: string;
    guard: string;
    tenantId: string;
    permissions: string[];
}

const roleSchema = yup.object({
    name: yup.string().required('Role name is required').min(1, 'Role name cannot be empty'),
    guard: yup.string().required('Guard is required').min(1, 'Guard cannot be empty'),
    tenantId: yup.string().optional(),
    permissions: yup.array().of(yup.string()).default([]),
});

export interface RoleFormProps {
    initialData?: Partial<RoleFormData>;
    tenants: Tenant[];
    onSubmit: (data: RoleFormData) => Promise<void>;
    onCancel: () => void;
    error?: string;
    submitLabel?: string;
    isEdit?: boolean;
    isSystemRole?: boolean;
    onActionsReady?: (actions: FormFooterAction[]) => void;
}

export const RoleForm: React.FC<RoleFormProps> = ({
    initialData,
    tenants,
    onSubmit,
    onCancel,
    error,
    submitLabel,
    isEdit = false,
    isSystemRole = false,
    onActionsReady,
}) => {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        watch,
        setValue,
    } = useForm<RoleFormData>({
        resolver: yupResolver(roleSchema) as any,
        defaultValues: initialData || {
            name: '',
            guard: 'web',
            tenantId: '',
            permissions: [],
        },
    });

    const guard = watch('guard');
    const [permissions, setPermissions] = React.useState<string[]>(initialData?.permissions || []);
    const permissionsRef = React.useRef<string[]>(initialData?.permissions || []);

    // Keep ref in sync with state
    React.useEffect(() => {
        permissionsRef.current = permissions;
        setValue('permissions', permissions);
    }, [permissions, setValue]);

    // Reset form when initialData changes (for edit mode)
    React.useEffect(() => {
        if (initialData) {
            reset(initialData);
            setPermissions(initialData.permissions || []);
            permissionsRef.current = initialData.permissions || [];
            setValue('permissions', initialData.permissions || []);
        }
    }, [initialData, reset, setValue]);

    const handleFormSubmit = async (data: RoleFormData) => {
        try {
            // Always use the latest permissions from ref to avoid closure issues
            await onSubmit({
                ...data,
                permissions: permissionsRef.current,
            });
            if (!isEdit) {
                reset();
                setPermissions([]);
                permissionsRef.current = [];
                setValue('permissions', []);
            }
        } catch (err) {
            // Error handled by parent
        }
    };

    // Wrapper to update both state and ref
    const handlePermissionsChange = React.useCallback((newPermissions: string[]) => {
        setPermissions(newPermissions);
        permissionsRef.current = newPermissions;
    }, []);

    const handleCancel = () => {
        if (!isEdit) {
            reset();
            setPermissions([]);
        }
        onCancel();
    };

    const tenantId = watch('tenantId');

    // Prepare footer actions
    const footerActions: FormFooterAction[] = React.useMemo(() => [
        {
            label: 'Cancel',
            onClick: handleCancel,
            variant: 'secondary' as const,
            disabled: isSubmitting,
        },
        {
            label: submitLabel || (isEdit ? 'Update Role' : 'Create Role'),
            onClick: () => {
                // Trigger form submission
                const form = document.getElementById('role-form') as HTMLFormElement;
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
        <form id="role-form" onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600">{error}</p>
                </div>
            )}

            <Controller
                name="name"
                control={control}
                render={({ field }) => (
                    <FormField
                        id="role-name"
                        label="Role Name"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                        error={errors.name?.message}
                        placeholder="admin, editor, viewer..."
                        startIcon={null}
                    />
                )}
            />

            <Controller
                name="guard"
                control={control}
                render={({ field }) => (
                    <FormField
                        id="guard"
                        label="Guard"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                        error={errors.guard?.message}
                        placeholder="web, api, admin..."
                        startIcon={null}
                        helpText="Guard determines which authentication context this role applies to"
                    />
                )}
            />

            {isEdit && initialData?.tenantId ? (
                <div className="p-2 bg-gray-50 rounded-lg">
                    <label className="text-xs font-medium text-gray-600">Tenant</label>
                    <p className="text-sm text-gray-900 font-medium mt-0.5">
                        {tenants.find(t => t.id === initialData.tenantId)?.name || initialData.tenantId}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Tenant cannot be changed after role creation
                    </p>
                </div>
            ) : !isEdit ? (
                <div>
                    <Controller
                        name="tenantId"
                        control={control}
                        render={({ field }) => (
                            <Select
                                label="Tenant (Optional)"
                                value={field.value}
                                onChange={field.onChange}
                                options={tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` }))}
                                placeholder="Leave empty for global role"
                                allowEmpty={true}
                            />
                        )}
                    />
                    {errors.tenantId && (
                        <p className="text-xs text-red-600 mt-0.5">{errors.tenantId.message}</p>
                    )}
                </div>
            ) : null}

            {isEdit && isSystemRole && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-900 mb-0.5">System Role</p>
                    <p className="text-xs text-amber-700">
                        This is a system role. Some fields may be restricted.
                    </p>
                </div>
            )}

            <div className="relative">
                <PermissionInput
                    label="Permissions"
                    value={permissions}
                    onChange={handlePermissionsChange}
                    placeholder="Type to search permissions..."
                    helperText="Type to search or press Enter to add. Use arrow keys to navigate suggestions."
                    guard={guard}
                />
            </div>
        </form>
    );
};
