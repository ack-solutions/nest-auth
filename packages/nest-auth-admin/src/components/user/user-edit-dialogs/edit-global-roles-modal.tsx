import React, { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import { Dialog } from '../../dialog';
import type { Role, User } from '../../../types';
import type { EditModalProps } from './types';

export interface EditGlobalRolesModalProps extends EditModalProps {
    roles: Role[];
}

export function EditGlobalRolesModal({ open, onClose, onSave, user, loading, roles }: EditGlobalRolesModalProps) {
    const [roleIds, setRoleIds] = useState<string[]>([]);

    useEffect(() => {
        if (!open) return;
        const globalAccess = (user.userAccesses ?? []).find((a) => a.tenantId == null);
        const ids =
            globalAccess?.roleIds ??
            (Array.isArray(globalAccess?.roles)
                ? globalAccess.roles.map((r: unknown) => (typeof r === 'string' ? r : (r as { id: string }).id))
                : []);
        setRoleIds(Array.isArray(ids) ? ids : []);
    }, [open, user]);

    const roleOptions = useMemo(
        () =>
            roles
                .filter((r) => !r.tenantId)
                .map((r) => ({ value: r.id, label: `${r.name} (${r.guard})` })),
        [roles],
    );

    const handleSave = () => {
        onSave({ roleIds } as Partial<User> as any);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Manage Roles"
            subTitle="Assign roles"
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
                {roleOptions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No global roles available.
                    </Typography>
                ) : (
                    <Box>
                        <TextField
                            select
                            fullWidth
                            label="Roles"
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

