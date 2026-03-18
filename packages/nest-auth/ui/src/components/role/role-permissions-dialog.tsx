import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Shield } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { FormDialog } from '../form-dialog';
import { FormFooterAction } from '../form-footer';
import { RolePermissionChecklist } from './role-permission-checklist';
import type { Role } from '../../types';

export interface RolePermissionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    role: Role | null;
    onSaved?: () => void;
    error?: string;
}

export const RolePermissionsDialog: React.FC<RolePermissionsDialogProps> = ({
    isOpen,
    onClose,
    role,
    onSaved,
    error: externalError,
}) => {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && role) {
            setPermissions(role.permissions ?? []);
            setError('');
        }
    }, [isOpen, role]);

    const handleSave = useCallback(async () => {
        if (!role) return;
        setError('');
        setSaving(true);
        try {
            const { api } = await import('../../services/api');
            await api.patch(`/api/roles/${role.id}`, { permissions });
            onSaved?.();
            onClose();
        } catch (err: any) {
            const msg = err?.message ?? 'Failed to update permissions';
            const detail = err?.response?.data?.message || err?.response?.data?.message;
            setError(detail || msg);
        } finally {
            setSaving(false);
        }
    }, [role, permissions, onSaved, onClose]);

    const actions: FormFooterAction[] = [
        {
            label: 'Cancel',
            onClick: onClose,
            variant: 'secondary',
            disabled: saving,
        },
        {
            label: 'Save permissions',
            onClick: handleSave,
            variant: 'primary',
            disabled: saving,
            icon: <Icon component={KeyRound} />,
        },
    ];

    const displayError = externalError || error;

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Edit role permissions"
            description="Assign permissions from the list below. Only permissions for this role's guard are shown."
            icon={<Icon component={Shield} sx={{ color: 'primary.main' }} />}
            maxWidth="md"
            actions={actions}
        >
            <Stack sx={{ p: 2 }} spacing={2}>
                {displayError && (
                    <Alert severity="error" onClose={() => setError('')} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                        {displayError}
                    </Alert>
                )}

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
                            value={permissions}
                            onChange={setPermissions}
                            disabled={saving}
                            placeholder="Search permissions by name or description..."
                        />
                    </>
                )}
            </Stack>
        </FormDialog>
    );
};
