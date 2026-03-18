import React, { useState, useMemo } from 'react';
import { Shield, Plus, Edit2, UserCircle, Building2 } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Paper from '@mui/material/Paper';
import { FormDialog } from '../form-dialog';
import { FormFooterAction } from '../form-footer';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FormField } from '../form/form-field';
import { Select } from '../select';
import { PermissionInput } from '../permission-input';
import type { Tenant, Role } from '../../types';

const sectionIconSx = { width: 18, height: 18, color: 'var(--mui-palette-primary-main)' };

export interface RoleFormData {
    name: string;
    guard: string;
    tenantId: string;
    isSystem: boolean;
    permissions: string[];
}

const roleSchema = yup.object({
    name: yup.string().required('Role name is required').min(1, 'Role name cannot be empty'),
    guard: yup.string().required('Guard is required').min(1, 'Guard cannot be empty'),
    tenantId: yup.string().optional(),
    isSystem: yup.boolean().default(false),
    permissions: yup.array().of(yup.string()).default([]),
});

export interface RoleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RoleFormData) => Promise<void>;
    tenants: Tenant[];
    role?: Role; // If provided, it's edit mode
    error?: string;
}

export const RoleDialog: React.FC<RoleDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    tenants,
    role,
    error,
}) => {
    const isEdit = !!role;
    const isSystemRole = role?.isSystem || false;

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        watch,
        setValue,
    } = useForm<RoleFormData>({
        resolver: yupResolver(roleSchema) as any,
        defaultValues: role ? {
            name: role.name,
            guard: role.guard,
            tenantId: role.tenantId || '',
            isSystem: role.isSystem || false,
            permissions: role.permissions || [],
        } : {
            name: '',
            guard: 'web',
            tenantId: '',
            isSystem: false,
            permissions: [],
        },
    });

    const guard = watch('guard');
    const isSystem = watch('isSystem');

    // Reset form when dialog opens or role changes (defaultValues only apply on mount)
    React.useEffect(() => {
        if (!isOpen) return;
        if (role) {
            reset({
                name: role.name,
                guard: role.guard,
                tenantId: role.tenantId || '',
                isSystem: role.isSystem ?? false,
                permissions: role.permissions || [],
            });
        } else {
            reset({
                name: '',
                guard: 'web',
                tenantId: '',
                isSystem: false,
                permissions: [],
            });
        }
    }, [isOpen, role, reset]);

    // Clear tenantId when isSystem is checked
    React.useEffect(() => {
        if (isSystem && !isEdit) {
            setValue('tenantId', '');
        }
    }, [isSystem, isEdit, setValue]);

    const handleFormSubmit = async (data: RoleFormData) => {
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
        if (!isEdit) reset();
        onClose();
    };

    // Footer actions - managed internally
    const actions: FormFooterAction[] = useMemo(() => [
        {
            label: 'Cancel',
            onClick: handleCancel,
            variant: 'secondary' as const,
            disabled: isSubmitting,
        },
        {
            label: isEdit ? 'Update Role' : 'Create Role',
            onClick: () => {
                const form = document.getElementById('role-form') as HTMLFormElement;
                if (form) {
                    form.requestSubmit();
                }
            },
            variant: 'primary' as const,
            disabled: isSubmitting,
            icon: isEdit ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />,
        },
    ], [handleCancel, isSubmitting, isEdit]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Edit Role' : 'Create New Role'}
            description={isEdit ? 'Update role name, guard, scope, and permissions' : 'Create a new role and assign permissions'}
            icon={<Shield style={{ width: 20, height: 20, color: 'var(--mui-palette-primary-main)' }} />}
            maxWidth="md"
            actions={actions}
        >
            <form id="role-form" onSubmit={handleSubmit(handleFormSubmit)}>
                <Stack sx={{ p: 2 }} spacing={2.5}>
                    {error && (
                        <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                            {error}
                        </Alert>
                    )}

                    {/* Section: Basics */}
                    <Box>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                            <UserCircle style={sectionIconSx} />
                            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                Basics
                            </Typography>
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
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
                                            placeholder="e.g. admin, editor, viewer"
                                            startIcon={null}
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
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
                                            placeholder="e.g. web, api"
                                            startIcon={null}
                                            helpText="Which authentication context this role applies to"
                                        />
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </Box>

                    {/* Section: Scope (System role + Tenant) */}
                    <Box>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                            <Building2 style={sectionIconSx} />
                            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                Scope
                            </Typography>
                        </Stack>
                        <Paper variant="outlined" sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                            <Controller
                                name="isSystem"
                                control={control}
                                render={({ field }) => {
                                    const isCurrentlySystem = isEdit && role?.isSystem && !role?.tenantId;
                                    const willBecomeNonSystem = isEdit && field.value === false && isCurrentlySystem;
                                    return (
                                        <Stack>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                sx={{
                                                    px: 2,
                                                    py: 1.5,
                                                    bgcolor: isSystem ? 'primary.50' : 'grey.50',
                                                    borderBottom: '1px solid',
                                                    borderColor: 'divider',
                                                }}
                                            >
                                                <Stack spacing={0.25}>
                                                    <Typography component="label" variant="body2" fontWeight={500} sx={{ cursor: 'pointer' }}>
                                                        System role
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {isSystem
                                                            ? 'Available across all tenants. No tenant selection needed.'
                                                            : isEdit
                                                                ? 'Uncheck to make this role tenant-specific.'
                                                                : 'Uncheck to assign this role to a specific tenant.'}
                                                    </Typography>
                                                </Stack>
                                                <Switch
                                                    checked={field.value || false}
                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                    disabled={isSubmitting}
                                                    color="primary"
                                                />
                                            </Stack>
                                            {!isEdit && (
                                                <Box sx={{ px: 2, py: 1.5 }}>
                                                    <Controller
                                                        name="tenantId"
                                                        control={control}
                                                        render={({ field }) => (
                                                            <Select
                                                                label="Tenant"
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                options={[{ value: '', label: 'No tenant (global)' }, ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` }))]}
                                                                placeholder={isSystem ? 'Not used for system roles' : 'Select a tenant'}
                                                                allowEmpty
                                                                disabled={isSystem}
                                                            />
                                                        )}
                                                    />
                                                    {!isSystem && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                            Leave empty for a global role, or pick a tenant for tenant-specific access.
                                                        </Typography>
                                                    )}
                                                    {errors.tenantId && (
                                                        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                                                            {errors.tenantId.message}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                            {isEdit && role?.tenantId && (
                                                <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50' }}>
                                                    <Typography variant="caption" fontWeight={500} color="text.secondary">
                                                        Tenant
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                                                        {tenants.find((t) => t.id === role.tenantId)?.name || role.tenantId}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                                                        Cannot be changed after creation
                                                    </Typography>
                                                </Box>
                                            )}
                                            {willBecomeNonSystem && (
                                                <Alert severity="warning" sx={{ mx: 2, mt: 1, mb: 1, py: 0.75 }}>
                                                    Making this role tenant-specific requires an assigned tenant.
                                                </Alert>
                                            )}
                                        </Stack>
                                    );
                                }}
                            />
                        </Paper>
                    </Box>

                    <Box>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                            <Shield style={sectionIconSx} />
                            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                Permissions
                            </Typography>
                        </Stack>
                        <Controller
                            name="permissions"
                            control={control}
                            render={({ field }) => (
                                <PermissionInput
                                    label=""
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    placeholder="Search and add permissions..."
                                    helperText="Permissions are selected by name and resolved to permission IDs on save."
                                    guard={guard}
                                    error={errors.permissions?.message as string | undefined}
                                />
                            )}
                        />
                    </Box>
                </Stack>
            </form>
        </FormDialog>
    );
};
