import React, { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import { Dialog } from '../../dialog';
import type { Role, User } from '../../../types';
import type { EditModalProps } from './types';

export interface EditPlatformRolesModalProps extends EditModalProps {
    roles: Role[];
}

/**
 * Manage a user's PLATFORM roles — the roles stored on their platform-access
 * row, which apply platform-wide and are entirely separate from any tenant
 * roles. Only global (tenant-less) roles are eligible.
 *
 * Roles only: this dialog never grants or revokes platform access itself.
 * Provisioning a platform user is done in application code
 * (`UserService.createPlatformUser`), so the console can't mint super-admins.
 */
export function EditPlatformRolesModal({ open, onClose, onSave, user, loading, roles }: EditPlatformRolesModalProps) {
    const [roleIds, setRoleIds] = useState<string[]>([]);

    useEffect(() => {
        if (!open) return;
        const access = user.platformAccess;
        const ids =
            access?.roleIds ??
            (Array.isArray(access?.roles)
                ? access.roles.map((r: unknown) => (typeof r === 'string' ? r : (r as { id: string }).id))
                : []);
        setRoleIds(Array.isArray(ids) ? ids : []);
    }, [open, user]);

    // Platform roles are platform-wide, so only tenant-less roles qualify.
    const roleOptions = useMemo(
        () =>
            roles
                .filter((r) => !r.tenantId)
                .map((r) => ({ value: r.id, label: `${r.name} (${r.guard})` })),
        [roles],
    );

    const handleSave = () => {
        onSave({ platformRoleIds: roleIds } as unknown as Partial<User>);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Manage Platform Roles"
            subTitle="Platform-wide roles — separate from tenant roles"
            maxWidth="sm"
            actions={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={2} sx={{ py: 2, minHeight: 160 }}>
                <Alert severity="info" sx={{ typography: 'caption' }}>
                    These roles apply across the whole platform and are stored on the user's platform
                    access — they do not affect any tenant membership. Only global (tenant-less) roles
                    can be used here.
                </Alert>
                {roleOptions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No global roles available. Create a role without a tenant to use it as a platform role.
                    </Typography>
                ) : (
                    <Box>
                        <TextField
                            select
                            fullWidth
                            label="Platform roles"
                            value={roleIds}
                            onChange={(e) => {
                                const raw = e.target.value;
                                setRoleIds(Array.isArray(raw) ? raw : [raw]);
                            }}
                            SelectProps={{
                                multiple: true,
                                renderValue: (selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {(selected as string[]).length === 0 ? (
                                            <Box component="span" sx={{ color: 'text.secondary' }}>
                                                Select roles...
                                            </Box>
                                        ) : (
                                            (selected as string[]).map((val) => {
                                                const opt = roleOptions.find((o) => o.value === val);
                                                return (
                                                    <Chip
                                                        key={val}
                                                        label={opt?.label ?? val}
                                                        size="small"
                                                        onDelete={(ev) => {
                                                            ev.stopPropagation();
                                                            setRoleIds((prev) => prev.filter((v) => v !== val));
                                                        }}
                                                        onMouseDown={(ev) => ev.stopPropagation()}
                                                    />
                                                );
                                            })
                                        )}
                                    </Box>
                                ),
                            }}
                        >
                            {roleOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>
                )}
            </Stack>
        </Dialog>
    );
}
