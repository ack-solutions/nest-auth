import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Shield } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { RolePermissionChecklist } from './role-permission-checklist';
import type { Role } from '../../types';
import { FormDialog } from '../form-dialog';
import { Button } from '@mui/material';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import { array, object, string } from 'yup';
import { RoleFormData } from './role-dialog';

export interface RolePermissionsDialogProps {
    open: boolean;
    onClose: () => void;
    role: Role | null;
    onSaved?: () => void;
    error?: string;
}

const roleSchema = object({
    name: string().label('Name').required(),
    guard: string().label('Guard').required(),
    permissions: array().of(string()).label('Permissions').required(),
});

const defaultValues: RoleFormData = {
    name: '',
    guard: '',
    permissions: [],
    tenantId: '',
    isSystem: false,
    isActive: true,
};

export const RolePermissionsDialog: React.FC<RolePermissionsDialogProps> = ({
    open,
    onClose,
    role,
    onSaved,
    error: externalError,
}) => {

    const methods = useForm<RoleFormData>({
        resolver: yupResolver(roleSchema) as any,
        defaultValues: role ? {
            name: role.name,
            guard: role.guard,
            permissions: role.permissions ?? [],
        } : defaultValues,
    });

    const {
        formState: { isSubmitting },
    } = methods;


    useEffect(() => {
        if (open && role) {
            methods.reset({
                name: role.name,
                guard: role.guard,
                permissions: role.permissions ?? [],
            });
        }
    }, [open, role]);

    const handleSave = useCallback(async (data: RoleFormData) => {
        if (!role) return;
        try {
            const { api } = await import('../../services/api');
            await api.patch(`/api/roles/${role.id}`, data);
            onSaved?.();
            onClose();
        } catch (err: any) {
            const msg = err?.message ?? 'Failed to update permissions';
            const detail = err?.response?.data?.message || err?.response?.data?.message;
        }
    }, [role, onSaved, onClose]);


    return (
        <FormDialog
            open={open}
            onClose={onClose}
            title="Edit role permissions"
            subTitle="Assign permissions from the list below. Only permissions for this role's guard are shown."
            icon={<Icon component={Shield} sx={{ color: 'primary.main' }} />}
            formContext={methods}
            onSuccess={handleSave}
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        disabled={isSubmitting}
                        type="button"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        loading={isSubmitting}
                    >
                        Save permissions
                    </Button>
                </>
            }
        >
            <Stack sx={{ p: 2 }} spacing={2}>
                {role && (
                    <>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
                                <Typography variant="body2" fontWeight={600} color="text.primary">
                                    {role.name}
                                </Typography>
                                <Chip size="small" label={role.guard} sx={{ height: 22, fontSize: '0.75rem' }} variant="outlined" color="primary" />
                                <Typography variant="caption" color="text.secondary">
                                    Only permissions for guard <strong>{role.guard}</strong> can be assigned. Custom permissions are not allowed.
                                </Typography>
                            </Stack>
                        </Box>

                        <RolePermissionChecklist
                            guard={role.guard}
                            value={methods.getValues('permissions')}
                            onChange={(permissions) => methods.setValue('permissions', permissions)}
                            disabled={isSubmitting}
                            placeholder="Search permissions by name or description..."
                        />
                    </>
                )}
            </Stack>
        </FormDialog>
    );
};
