import React from 'react';
import { Shield, UserCircle, Building2, KeyRound } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import { FormDialog } from '../form-dialog';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { RHFTextField } from '../form/hook-form-fields/rhf-text-field';
import { RHFSelect } from '../form/hook-form-fields/rhf-select';
import { RHFSwitch } from '../form/hook-form-fields/rhf-switch';
import { RHFRolePermissionChecklist } from '../form/hook-form-fields/rhf-role-permission-checklist';
import { useRoleGuards } from '../../hooks/use-role-guards';
import type { Tenant, Role } from '../../types';
import { Button } from '@mui/material';

const sectionIconSx = { color: 'var(--mui-palette-primary-main)' };

export interface RoleFormData {
    name: string;
    guard: string;
    tenantId: string;
    isSystem: boolean;
    isActive: boolean;
    permissions: string[];
}

const createRoleSchema = yup.object({
    name: yup.string().required('Role name is required').min(1, 'Role name cannot be empty'),
    guard: yup.string().required('Guard is required').min(1, 'Guard cannot be empty'),
    tenantId: yup.string().optional(),
    isSystem: yup.boolean().default(false),
    isActive: yup.boolean().default(true),
    permissions: yup.array().of(yup.string()).default([]),
});

const editRoleSchema = yup.object({
    name: yup.string().required('Role name is required').min(1, 'Role name cannot be empty'),
    guard: yup.string().optional(),
    tenantId: yup.string().optional(),
    isSystem: yup.boolean().optional(),
    isActive: yup.boolean().default(true),
    permissions: yup.array().of(yup.string()).default([]),
});

export interface RoleDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: RoleFormData) => Promise<void>;
    tenants: Tenant[];
    role?: Role; // If provided, it's edit mode
    error?: string;
}

export const RoleDialog: React.FC<RoleDialogProps> = ({
    open,
    onClose,
    onSubmit,
    tenants,
    role,
    error,
}) => {
    const isEdit = !!role;
    const schema = isEdit ? editRoleSchema : createRoleSchema;
    const { roleGuards, guardOptions, helperText: guardHelperText } = useRoleGuards();

    const methods = useForm<RoleFormData>({
        resolver: yupResolver(schema) as any,
        defaultValues: role ? {
            name: role.name,
            guard: role.guard,
            tenantId: role.tenantId || '',
            isSystem: role.isSystem || false,
            isActive: role.isActive ?? true,
            permissions: role.permissions ?? [],
        } : {
            name: '',
            guard: roleGuards[0] || 'web',
            tenantId: '',
            isSystem: false,
            isActive: true,
            permissions: [],
        },
    });

    const {
        control,
        formState: { isSubmitting },
        reset,
        watch,
        setValue,
    } = methods;

    const guard = watch('guard');
    const isSystem = watch('isSystem');

    // Reset form when dialog opens or role changes (defaultValues only apply on mount)
    React.useEffect(() => {
        if (!open) return;
        if (role) {
            reset({
                name: role.name,
                guard: role.guard,
                tenantId: role.tenantId || '',
                isSystem: role.isSystem ?? false,
                isActive: role.isActive ?? true,
                permissions: role.permissions ?? [],
            });
        } else {
            reset({
                name: '',
                guard: roleGuards[0] || 'web',
                tenantId: '',
                isSystem: false,
                isActive: true,
                permissions: [],
            });
        }
    }, [open, role, roleGuards, reset]);

    // Clear tenantId when isSystem is checked (create only)
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

    return (
        <FormDialog
            formContext={methods}
            onSuccess={handleFormSubmit}
            open={open}
            onClose={onClose}
            title={isEdit ? 'Edit Role' : 'Create New Role'}
            subTitle={isEdit ? 'Update role name, active status, and permissions' : 'Create a new role and assign permissions'}
            icon={<Icon component={Shield} sx={{ color: 'primary.main' }} />}
            maxWidth="md"
            actions={
                <>
                    <Button variant="outlined" color="primary" disabled={isSubmitting} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" disabled={isSubmitting} onClick={methods.handleSubmit(handleFormSubmit)}>
                        {isEdit ? 'Update Role' : 'Create Role'}
                    </Button>
                </>
            }
        >
                <Stack sx={{ p: 2 }} spacing={2.5}>
                    {error && (
                        <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                            {error}
                        </Alert>
                    )}

                    {/* Section: Basics */}
                    <Box>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                            <Icon component={UserCircle} sx={sectionIconSx} />
                            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                Basics
                            </Typography>
                        </Stack>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: isEdit ? 12 : 6 }}>
                                <RHFTextField
                                    name="name"
                                    id="role-name"
                                    label="Role Name"
                                    disabled={isSubmitting}
                                    placeholder="e.g. admin, editor, viewer"
                                />
                            </Grid>
                            {!isEdit && (
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <RHFSelect
                                        name="guard"
                                        label="Guard"
                                        options={guardOptions}
                                        placeholder="Select guard"
                                        disabled={isSubmitting}
                                        helperText={guardHelperText}
                                    />
                                </Grid>
                            )}
                        </Grid>
                        {isEdit && role && (
                            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Guard: <strong>{role.guard}</strong>
                                </Typography>
                                <Typography variant="caption" color="text.secondary">·</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {role.isSystem ? 'System role' : role.tenantId
                                        ? `Tenant: ${tenants.find((t) => t.id === role.tenantId)?.name || role.tenantId}`
                                        : 'Global'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">(cannot be changed)</Typography>
                            </Stack>
                        )}
                        <Box sx={{ mt: 2 }}>
                            <RHFSwitch
                                name="isActive"
                                label="Active"
                                disabled={isSubmitting}
                                defaultChecked
                            />
                        </Box>
                    </Box>

                    {!isEdit && (
                        <>
                            {/* Section: Scope (Create only) */}
                            <Box>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                    <Icon component={Building2} sx={sectionIconSx} />
                                    <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                        Scope
                                    </Typography>
                                </Stack>
                                <Paper variant="outlined" sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                                    <Stack>
                                        <RHFSwitch
                                            name="isSystem"
                                            label="System role"
                                            defaultChecked={isSystem}
                                            disabled={isSubmitting}
                                            sx={{
                                                px: 2,
                                                py: 1.5,
                                                bgcolor: isSystem ? 'primary.50' : 'grey.50',
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        />
                                        <Box sx={{ px: 2, py: 1.5 }}>
                                            <RHFSelect
                                                name="tenantId"
                                                label="Tenant"
                                                options={[
                                                    { value: '', label: 'No tenant (global)' },
                                                    ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` })),
                                                ]}
                                                placeholder={isSystem ? 'Not used for system roles' : 'Select a tenant'}
                                                disabled={isSystem || isSubmitting}
                                            />
                                            {!isSystem && (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                    Leave empty for a global role, or pick a tenant for tenant-specific access.
                                                </Typography>
                                            )}
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Box>
                        </>
                    )}

                    {/* Section: Permissions */}
                    <Box>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                            <Icon component={KeyRound} sx={sectionIconSx} />
                            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                Permissions
                            </Typography>
                        </Stack>
                        <RHFRolePermissionChecklist
                            name="permissions"
                            control={control}
                            guard={isEdit && role ? role.guard : guard}
                            disabled={isSubmitting}
                            placeholder="Search permissions..."
                        />
                    </Box>
                </Stack>
        </FormDialog>
    );
};
