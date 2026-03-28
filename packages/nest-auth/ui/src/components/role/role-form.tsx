import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { RHFTextField } from '../form/rhf-text-field';
import { RHFSelect } from '../form/rhf-select';
import { FormFooterAction } from '../form-footer';
import { useRoleGuards } from '../../hooks/use-role-guards';
import { Plus, Pencil } from 'lucide-react';
import Icon from '@mui/material/Icon';
import type { Tenant } from '../../types';

export interface RoleFormData {
    name: string;
    guard: string;
    tenantId: string;
}

const roleSchema = yup.object({
    name: yup.string().required('Role name is required').min(1, 'Role name cannot be empty'),
    guard: yup.string().required('Guard is required').min(1, 'Guard cannot be empty'),
    tenantId: yup.string().optional(),
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
    const { guardOptions, helperText: guardHelperText } = useRoleGuards();
    const {
        control,
        handleSubmit,
        formState: { isSubmitting },
        reset,
        setValue,
    } = useForm<RoleFormData>({
        resolver: yupResolver(roleSchema) as any,
        defaultValues: initialData || {
            name: '',
            guard: guardOptions[0]?.value ?? 'web',
            tenantId: '',
        },
    });

    // Reset form when initialData changes (for edit mode)
    React.useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset, setValue]);

    const handleFormSubmit = async (data: RoleFormData) => {
        try {
            await onSubmit({
                ...data,
            });
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
            label: submitLabel || (isEdit ? 'Update Role' : 'Create Role'),
            onClick: () => {
                const form = document.getElementById('role-form') as HTMLFormElement;
                if (form) {
                    form.requestSubmit();
                }
            },
            variant: 'primary' as const,
            disabled: isSubmitting,
            icon: isEdit ? <Icon component={Pencil} /> : <Icon component={Plus} />,
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

                <RHFTextField
                    name="name"
                    control={control}
                    id="role-name"
                    label="Role Name"
                    disabled={isSubmitting}
                    placeholder="admin, editor, viewer..."
                />

                {!isEdit && (
                    <RHFSelect
                        name="guard"
                        control={control}
                        label="Guard"
                        options={guardOptions}
                        placeholder="Select guard"
                        allowEmpty={false}
                        disabled={isSubmitting}
                        caption={guardHelperText}
                    />
                )}

                {isEdit && initialData && (
                    <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="caption" fontWeight={500} color="text.secondary">Guard</Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>{initialData.guard ?? '—'}</Typography>
                        {(initialData.tenantId || isSystemRole) && (
                            <>
                                <Typography variant="caption" fontWeight={500} color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    {isSystemRole ? 'Scope' : 'Tenant'}
                                </Typography>
                                <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                                    {isSystemRole ? 'System role' : tenants.find(t => t.id === initialData.tenantId)?.name || initialData.tenantId || '—'}
                                </Typography>
                            </>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>Guard and tenant cannot be changed after creation</Typography>
                    </Box>
                )}

                {!isEdit && (
                    <div>
                        <RHFSelect
                            name="tenantId"
                            control={control}
                            label="Tenant (Optional)"
                            options={tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` }))}
                            placeholder="Leave empty for global role"
                            allowEmpty={true}
                            disabled={isSubmitting}
                        />
                    </div>
                )}

                {isEdit && isSystemRole && (
                    <Alert severity="info" sx={{ py: 0 }}>
                        <Typography variant="caption" fontWeight={500} sx={{ display: 'block' }}>System Role</Typography>
                        <Typography variant="caption">This is a system role. Some fields may be restricted.</Typography>
                    </Alert>
                )}
            </Stack>
        </form>
    );
};
