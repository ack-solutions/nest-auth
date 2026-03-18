import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Shield } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { FormDialog } from '../form-dialog';
import { FormFooterAction } from '../form-footer';
import { PermissionInput } from '../permission-input';
import type { Role } from '../../types';

const sectionIconSx = { width: 18, height: 18, color: 'var(--mui-palette-primary-main)' };

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
            setError(err?.message ?? 'Failed to update permissions');
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
            icon: <KeyRound style={{ width: 16, height: 16 }} />,
        },
    ];

    const displayError = externalError || error;

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Edit role permissions"
            description={role ? `Manage permissions for role "${role.name}"` : ''}
            icon={<Shield style={{ width: 20, height: 20, color: 'var(--mui-palette-primary-main)' }} />}
            maxWidth="md"
            actions={actions}
        >
            <Stack sx={{ p: 2 }} spacing={2}>
                {displayError && (
                    <Alert severity="error" onClose={() => setError('')}>
                        {displayError}
                    </Alert>
                )}
                {role && (
                    <>
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                <KeyRound style={sectionIconSx} />
                                <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                                    Permissions
                                </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                Role: <strong>{role.name}</strong> (Guard: {role.guard})
                            </Typography>
                            <PermissionInput
                                label=""
                                value={permissions}
                                onChange={setPermissions}
                                placeholder="Search and add permissions..."
                                helperText="Type to search, press Enter to add. Permissions can be added after the role is created."
                                guard={role.guard}
                            />
                        </Box>
                    </>
                )}
            </Stack>
        </FormDialog>
    );
};
