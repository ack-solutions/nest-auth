import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import { Dialog } from '../../dialog';
import type { Role, Tenant, User } from '../../../types';
import type { EditModalProps } from './types';

export interface EditRolesModalProps extends EditModalProps {
    roles: Role[];
    tenants: Tenant[];
}

export function EditRolesModal({ open, onClose, onSave, user, loading, roles, tenants }: EditRolesModalProps) {
    const [tenantRoleIds, setTenantRoleIds] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (open && user.userAccesses?.length) {
            const next: Record<string, string[]> = {};
            for (const m of user.userAccesses) {
                next[m.tenantId] =
                    m.roleIds ??
                    (Array.isArray(m.roles) ? m.roles.map((r: unknown) => (typeof r === 'string' ? r : (r as { id: string }).id)) : []);
            }
            setTenantRoleIds(next);
        }
    }, [open, user]);

    const handleSave = () => {
        const tenantRoles = Object.entries(tenantRoleIds).map(([tenantId, roleIds]) => ({
            tenantId,
            roleIds: roleIds ?? [],
        }));
        onSave({ tenantRoles } as Partial<User>);
    };

    const updateRolesForTenant = (tenantId: string, roleIds: string[]) => {
        setTenantRoleIds((prev) => ({ ...prev, [tenantId]: roleIds }));
    };

    const accessTenants = (user.userAccesses ?? []).map((m) => ({
        tenantId: m.tenantId,
        tenant: m.tenant ?? tenants.find((t) => t.id === m.tenantId),
    }));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Manage Roles by Tenant"
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
            <Stack spacing={2} sx={{ py: 2, minHeight: 200 }}>
                {!accessTenants.length ? (
                    <Typography variant="body2" color="text.secondary">
                        User has no tenants. Add tenants first, then assign roles.
                    </Typography>
                ) : (
                    accessTenants.map(({ tenantId, tenant }) => {
                        const roleOptions = roles
                            .filter((r) => !r.tenantId || r.tenantId === tenantId)
                            .map((r) => ({
                                value: r.id,
                                label: r.tenantId ? `${r.name} (${r.guard})` : `${r.name} (${r.guard}) – Global`,
                            }));
                        const value = tenantRoleIds[tenantId] ?? [];
                        return (
                            <Box
                                key={tenantId}
                                sx={{
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'grey.50',
                                    p: 1.5,
                                }}
                            >
                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="body2" fontWeight="500">
                                        {tenant?.name ?? tenant?.slug ?? tenantId}
                                    </Typography>
                                </Box>
                                <TextField
                                    select
                                    fullWidth
                                    value={value}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        updateRolesForTenant(tenantId, Array.isArray(raw) ? raw : [raw]);
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
                                                                    updateRolesForTenant(
                                                                        tenantId,
                                                                        value.filter((v) => v !== val),
                                                                    );
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
                                    {roleOptions.length === 0 ? (
                                        <MenuItem disabled>No options available</MenuItem>
                                    ) : (
                                        roleOptions.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))
                                    )}
                                </TextField>
                            </Box>
                        );
                    })
                )}
            </Stack>
        </Dialog>
    );
}
