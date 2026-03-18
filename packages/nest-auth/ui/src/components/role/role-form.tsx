import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { FormField } from '../form/form-field';
import { Select } from '../select';
import { PermissionInput } from '../permission-input';
import { FormFooterAction } from '../form-footer';
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
        <form id="role-form" onSubmit={handleSubmit(handleFormSubmit)}>
            <Stack sx={{ p: 2 }} spacing={1.5}>
            {error && (
                <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>
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
                <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" fontWeight={500} color="text.secondary">Tenant</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>{tenants.find(t => t.id === initialData.tenantId)?.name || initialData.tenantId}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>Tenant cannot be changed after role creation</Typography>
                </Box>
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
                        <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>{errors.tenantId.message}</Typography>
                    )}
                </div>
            ) : null}

            {isEdit && isSystemRole && (
                <Alert severity="info" sx={{ py: 0 }}>
                    <Typography variant="caption" fontWeight={500} sx={{ display: 'block' }}>System Role</Typography>
                    <Typography variant="caption">This is a system role. Some fields may be restricted.</Typography>
                </Alert>
            )}

            <Box sx={{ position: 'relative' }}>
                <PermissionInput
                    label="Permissions"
                    value={permissions}
                    onChange={handlePermissionsChange}
                    placeholder="Type to search permissions..."
                    helperText="Type to search or press Enter to add. Use arrow keys to navigate suggestions."
                    guard={guard}
                />
            </Box>
            </Stack>
        </form>
    );
};
