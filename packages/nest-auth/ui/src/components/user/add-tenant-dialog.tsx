import React, { useState, useEffect } from 'react';
import { Modal } from '../modal';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { api } from '../../services/api';
import type { Tenant, Role } from '../../types';

export interface AddTenantDialogProps {
    open: boolean;
    onClose: () => void;
    onAdd: (tenantId: string, roleIds: string[]) => Promise<void>;
    tenants: Tenant[];
    existingTenantIds: string[];
}

export const AddTenantDialog: React.FC<AddTenantDialogProps> = ({
    open,
    onClose,
    onAdd,
    tenants,
    existingTenantIds,
}) => {
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [roleIds, setRoleIds] = useState<string[]>([]);
    const [rolesForTenant, setRolesForTenant] = useState<Role[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const availableTenants = tenants.filter((t) => !existingTenantIds.includes(t.id));
    const tenantOptions = availableTenants.map((t) => ({ value: t.id, label: `${t.name || t.slug} (${t.slug || t.id})` }));
    const roleOptions = rolesForTenant.map((r) => ({
        value: r.id,
        label: r.tenantId ? `${r.name} (${r.guard})` : `${r.name} (${r.guard}) – Global`,
    }));

    useEffect(() => {
        if (!open) {
            setSelectedTenantId('');
            setRoleIds([]);
            setRolesForTenant([]);
            setError('');
            return;
        }
    }, [open]);

    useEffect(() => {
        if (!selectedTenantId) {
            setRolesForTenant([]);
            setRoleIds([]);
            return;
        }
        let cancelled = false;
        setLoadingRoles(true);
        api.get<{ data: Role[] }>(`/api/roles?tenantId=${encodeURIComponent(selectedTenantId)}`)
            .then((res) => {
                if (!cancelled && res.data) {
                    setRolesForTenant(Array.isArray(res.data) ? res.data : []);
                    setRoleIds([]);
                }
            })
            .catch(() => {
                if (!cancelled) setRolesForTenant([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingRoles(false);
            });
        return () => { cancelled = true; };
    }, [selectedTenantId]);

    const handleSave = async () => {
        if (!selectedTenantId) {
            setError('Select a tenant');
            return;
        }
        setError('');
        setSaving(true);
        try {
            await onAdd(selectedTenantId, roleIds);
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Failed to add tenant');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Add tenant"
            subTitle="Assign the user to a tenant and optionally select roles"
            maxWidth="sm"
            footer={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={saving || !selectedTenantId}>
                        {saving ? 'Adding...' : 'Add tenant'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={2} sx={{ py: 1 }}>
                {error && (
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                )}
                <TextField
                    select
                    fullWidth
                    label="Tenant"
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    SelectProps={{ displayEmpty: true }}
                >
                    <MenuItem value="">
                        <em>Select a tenant</em>
                    </MenuItem>
                    {tenantOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </MenuItem>
                    ))}
                </TextField>
                {selectedTenantId && (
                    <TextField
                        select
                        fullWidth
                        disabled={loadingRoles}
                        label="Roles (optional)"
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
                                            {loadingRoles ? 'Loading roles...' : 'Select roles...'}
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
                )}
            </Stack>
        </Modal>
    );
};
