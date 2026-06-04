import React, { useEffect, useMemo, useState } from 'react';
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
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import { array, object, string } from 'yup';
import { api } from '../../services/api';

export interface RolePermissionsDialogProps {
    open: boolean;
    onClose: () => void;
    role: Role | null;
    onSaved?: () => void;
    error?: string;
}

interface RolePermissionsFormData {
    permissions: string[];
}

const roleSchema = object({
    permissions: array().of(string()).label('Permissions').required(),
});

const defaultValues: RolePermissionsFormData = {
    permissions: [],
};

export const RolePermissionsDialog: React.FC<RolePermissionsDialogProps> = ({
    open,
    onClose,
    role,
    onSaved,
    error: externalError,
}) => {
    const [error, setError] = useState<string>('');

    const methods = useForm<RolePermissionsFormData>({
        resolver: yupResolver(roleSchema) as any,
        defaultValues,
    });

    const {
        formState: { isSubmitting },
        watch,
    } = methods;

    const permissions = watch('permissions');
    const selectedCount = Array.isArray(permissions) ? permissions.length : 0;

    useEffect(() => {
        if (open && role) {
            setError('');
            methods.reset({
                permissions: role.permissions ?? [],
            });
        }
        if (open && !role) {
            setError('');
            methods.reset(defaultValues);
        }
    }, [open, role, methods]);

    const roleHeader = useMemo(() => {
        if (!role) return null;
        return (
            <Box
                sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} useFlexGap flexWrap="wrap">
                    <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                            {role.name}
                        </Typography>
                        <Chip
                            size="small"
                            label={role.guard}
                            sx={{ height: 22, fontSize: '0.75rem' }}
                            variant="outlined"
                            color="primary"
                        />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        {selectedCount} selected
                    </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    Only permissions for guard <strong>{role.guard}</strong> can be assigned.
                </Typography>
            </Box>
        );
    }, [role, selectedCount]);

    return (
        <FormDialog
            open={open}
            onClose={onClose}
            title="Edit Permissions"
            subTitle="Select permissions for this role."
            icon={<Icon component={Shield} sx={{ color: 'primary.main' }} />}
            formContext={methods}
            onSuccess={async (data) => {
                if (!role) return;
                try {
                    setError('');
                    await api.patch(`/api/roles/${role.id}`, { permissions: data.permissions ?? [] });
                    onSaved?.();
                    onClose();
                } catch (err: any) {
                    setError(err?.message ?? 'Failed to update permissions');
                    throw err;
                }
            }}
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        color="inherit"
                        disabled={isSubmitting}
                        type="button"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        loading={isSubmitting}
                        type="submit"
                        disabled={!role || isSubmitting}
                    >
                        Save permissions
                    </Button>
                </>
            }
        >
            <Stack sx={{ p: 2 }} spacing={2}>
                {(externalError || error) && (
                    <Alert severity="error" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                        {externalError || error}
                    </Alert>
                )}

                {roleHeader}

                <Divider />

                {role ? (
                    <RolePermissionChecklist
                        guard={role.guard}
                        value={methods.getValues('permissions')}
                        onChange={(next) => methods.setValue('permissions', next, { shouldDirty: true })}
                        disabled={isSubmitting}
                        placeholder="Search permissions..."
                    />
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        Select a role to edit permissions.
                    </Typography>
                )}
            </Stack>
        </FormDialog>
    );
};
