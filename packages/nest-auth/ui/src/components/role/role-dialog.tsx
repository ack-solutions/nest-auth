import React from 'react';
import { Shield, KeyRound } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { FormDialog } from '../form-dialog';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { RHFTextField } from '../form/hook-form-fields/rhf-text-field';
import { RHFSelect } from '../form/hook-form-fields/rhf-select';
import { RHFSwitch } from '../form/hook-form-fields/rhf-switch';
import { RHFRolePermissionChecklist } from '../form/hook-form-fields/rhf-role-permission-checklist';
import type { Tenant, Role } from '../../types';
import { useClientConfig } from '@/hooks/use-client-config';

export interface RoleFormData {
    name: string;
    guard: string;
    tenantId: string;
    isSystem: boolean;
    isActive: boolean;
    permissions: string[];
}

type RoleScope = 'global' | 'tenant' | 'system';

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
    const { roleGuards } = useClientConfig();

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
    const tenantId = watch('tenantId');
    const isActive = watch('isActive');
    const permissions = watch('permissions');

    const scope: RoleScope = isSystem ? 'system' : tenantId ? 'tenant' : 'global';

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

    // Keep scope fields consistent (create only)
    React.useEffect(() => {
        if (isSystem && !isEdit) {
            setValue('tenantId', '');
        }
    }, [isSystem, isEdit, setValue]);

    const handleScopeChange = (_: unknown, next: RoleScope | null) => {
        if (!next || isEdit) return;
        if (next === 'system') {
            setValue('isSystem', true);
            setValue('tenantId', '');
            return;
        }
        if (next === 'global') {
            setValue('isSystem', false);
            setValue('tenantId', '');
            return;
        }
        // tenant
        setValue('isSystem', false);
    };

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
            subTitle={isEdit ? 'Update role details and permissions' : 'Create a role and assign permissions'}
            icon={<Icon component={Shield} sx={{ color: 'primary.main' }} />}
            maxWidth="md"
            actions={
                <>
                    <Button variant="outlined" color="inherit" disabled={isSubmitting} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" disabled={isSubmitting} type="submit">
                        {isEdit ? 'Update Role' : 'Create Role'}
                    </Button>
                </>
            }
        >
            <Stack sx={{ p: 2 }} spacing={2}>
                {error && (
                    <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={2} alignItems="flex-start">
                    <Grid size={{ xs: 12, sm: isEdit ? 12 : 7 }}>
                        <RHFTextField
                            name="name"
                            id="role-name"
                            label="Role Name"
                            disabled={isSubmitting}
                            placeholder="e.g. admin, editor, viewer"
                        />
                    </Grid>
                    {!isEdit && (
                        <Grid size={{ xs: 12, sm: 5 }}>
                            <RHFSelect
                                name="guard"
                                label="Guard"
                                options={roleGuards}
                                placeholder="Select guard"
                                disabled={isSubmitting}
                            />
                        </Grid>
                    )}
                </Grid>

                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                        {isEdit && role ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Box component="span">
                                    Guard:{' '}
                                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                        {role.guard}
                                    </Box>
                                </Box>
                                <Box component="span">·</Box>
                                <Box component="span">
                                    Scope:{' '}
                                    <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                        {role.isSystem
                                            ? 'System'
                                            : role.tenantId
                                                ? (tenants.find((t) => t.id === role.tenantId)?.name ?? 'Tenant')
                                                : 'Global'}
                                    </Box>
                                </Box>
                                <Box component="span">(scope cannot be changed)</Box>
                            </Stack>
                        ) : (
                            <Box component="span">
                                Status:{' '}
                                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                    {isActive ? 'Active' : 'Inactive'}
                                </Box>
                            </Box>
                        )}
                    </Box>
                    <RHFSwitch
                        name="isActive"
                        label="Active"
                        disabled={isSubmitting}
                        defaultChecked
                        sx={{ m: 0 }}
                    />
                </Stack>

                {!isEdit && (
                    <Box>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                            Scope
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="flex-start" useFlexGap flexWrap="wrap">
                            <ToggleButtonGroup
                                exclusive
                                value={scope}
                                onChange={handleScopeChange}
                                size="small"
                                disabled={isSubmitting}
                                sx={{ flexShrink: 0 }}
                            >
                                <ToggleButton value="global">Global</ToggleButton>
                                <ToggleButton value="tenant">Tenant</ToggleButton>
                                <ToggleButton value="system">System</ToggleButton>
                            </ToggleButtonGroup>

                            {scope === 'tenant' ? (
                                <Box sx={{ minWidth: 260, flex: 1 }}>
                                    <RHFSelect
                                        name="tenantId"
                                        label="Tenant"
                                        options={[
                                            { value: '', label: 'Select tenant...' },
                                            ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` })),
                                        ]}
                                        placeholder="Select tenant..."
                                        disabled={isSubmitting}
                                        required
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        Tenant roles are visible only within that tenant.
                                    </Typography>
                                </Box>
                            ) : null}
                        </Stack>

                        <Divider sx={{ mt: 2 }} />
                    </Box>
                )}

                {/* Section: Permissions */}
                <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Icon component={KeyRound} sx={{ color: 'primary.main' }} />
                            <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                Permissions
                            </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                            {Array.isArray(permissions) ? permissions.length : 0} selected
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
