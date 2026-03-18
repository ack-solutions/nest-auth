import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Building2, Key, Edit2, KeyRound } from 'lucide-react';
import { Box, Grid, Stack, Typography, Alert, Chip, Card, CardContent, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { api } from '../services/api';
import { useConfirm } from '../hooks/use-confirm';
import type { Role, Tenant } from '../types';
import { PageHeader } from '../components/page-header';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { Table, Column } from '../components/table';
import { RoleDialog } from '../components/role/role-dialog';
import { RolePermissionsDialog } from '../components/role/role-permissions-dialog';
import type { RoleFormData } from '../components/role/role-dialog';

export const RolesPage: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [error, setError] = useState('');
    const [dialogError, setDialogError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [permissionsDialogRole, setPermissionsDialogRole] = useState<Role | null>(null);
    const [filterGuard, setFilterGuard] = useState('');
    const [filterTenantId, setFilterTenantId] = useState<string>('');
    const confirm = useConfirm();

    const loadRoles = useCallback(async (overrides?: { guard?: string; tenantId?: string }) => {
        try {
            setError('');
            setLoading(true);
            const guard = (overrides?.guard ?? filterGuard).trim();
            const tenantId = overrides?.tenantId ?? filterTenantId;
            const params = new URLSearchParams();
            if (guard) params.set('guard', guard);
            if (tenantId) params.set('tenantId', tenantId);
            const url = params.toString() ? `/api/roles?${params.toString()}` : '/api/roles';
            const { data } = await api.get<{ data: Role[] }>(url);
            setRoles(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filterGuard, filterTenantId]);

    const loadTenants = useCallback(async () => {
        try {
            const { data } = await api.get<{ data: Tenant[] }>('/api/tenants');
            setTenants(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load tenants:', err);
        }
    }, []);

    useEffect(() => {
        loadTenants();
    }, [loadTenants]);

    useEffect(() => {
        loadRoles();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
    }, []);

    const handleSubmitRole = async (data: RoleFormData) => {
        setDialogError('');
        try {
            const payload: any = {
                name: data.name.trim(),
                guard: data.guard.trim() || 'web',
                permissions: data.permissions,
            };

            if (editingRole) {
                // Edit mode - include isSystem if it's being changed
                if (data.isSystem !== undefined) {
                    payload.isSystem = data.isSystem;
                }
                await api.patch(`/api/roles/${editingRole.id}`, payload);
            } else {
                // Create mode
                payload.isSystem = data.isSystem || false;
                if (data.tenantId && !data.isSystem) {
                    payload.tenantId = data.tenantId;
                }
                await api.post('/api/roles', payload);
            }

            setShowDialog(false);
            setEditingRole(null);
            await loadRoles();
        } catch (err: any) {
            setDialogError(err.message);
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setError('');
            const confirmed = await confirm('Are you sure you want to delete this role? This action cannot be undone.');
            if (!confirmed) {
                return;
            }
            await api.delete(`/api/roles/${id}`);
            await loadRoles();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setDialogError('');
        setShowDialog(true);
    };

    const handleEditPermissions = (role: Role) => {
        setPermissionsDialogRole(role);
    };

    const handleCreate = () => {
        setEditingRole(null);
        setDialogError('');
        setShowDialog(true);
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        setEditingRole(null);
        setDialogError('');
    };


    const stats = {
        total: roles.length,
        global: roles.filter((r) => !r.tenantId).length,
        tenant: roles.filter((r) => r.tenantId).length,
        system: roles.filter((r) => r.isSystem).length,
    };

    const columns: Column<Role>[] = [
        {
            key: 'name',
            label: 'Role Name',
            render: (role) => (
                <Box>
                    <Typography variant="body2" fontWeight="500">{role.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>Guard: <Chip size="small" label={role.guard} sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'secondary.100', color: 'secondary.800' }} /></Typography>
                </Box>
            ),
        },
        {
            key: 'permissions',
            label: 'Permissions',
            render: (role) => (
                <Typography variant="caption" color="text.secondary">
                    {role.permissions?.length || 0} permission{(role.permissions?.length || 0) !== 1 ? 's' : ''}
                </Typography>
            ),
        },
        {
            key: 'tenant',
            label: 'Tenant',
            render: (role) => (
                <Typography variant="caption" color="text.secondary">
                    {role.isSystem ? '—' : (role.tenant?.name ?? role.tenant?.slug ?? '—')}
                </Typography>
            ),
        },
        {
            key: 'type',
            label: 'Type',
            render: (role) => {
                if (role.isSystem) return <Chip size="small" label="System" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'warning.100', color: 'warning.800' }} />;
                if (role.tenantId) return <Chip size="small" label="Tenant" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'success.100', color: 'success.800' }} />;
                return <Chip size="small" label="Global" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'primary.100', color: 'primary.800' }} />;
            },
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (role) => (
                <Typography variant="caption" color="text.secondary">{new Date(role.createdAt).toLocaleDateString()}</Typography>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (role) => (
                <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                    <IconButton size="small" color="inherit" onClick={() => handleEditPermissions(role)} aria-label="Edit permissions" title="Edit permissions">
                        <KeyRound style={{ width: 20, height: 20 }} />
                    </IconButton>
                    <IconButton size="small" color="inherit" onClick={() => handleEdit(role)} aria-label="Edit role">
                        <Edit2 style={{ width: 20, height: 20 }} />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(role.id)} aria-label="Delete role">
                        <Trash2 style={{ width: 20, height: 20 }} />
                    </IconButton>
                </Stack>
            ),
        },
    ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PageHeader
                title="Role Management"
                description="Define permissions and manage access control across your application"
                onRefresh={() => loadRoles()}
                loading={loading}
                action={
                    <Button variant="contained" color="primary" onClick={handleCreate} startIcon={<Plus style={{ width: 20, height: 20 }} />}>
                        Create Role
                    </Button>
                }
            />

            <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box><Typography variant="caption" fontWeight="500" color="text.secondary">Total Roles</Typography><Typography variant="h5" fontWeight="bold" color="secondary.main">{stats.total}</Typography></Box>
                                <Box sx={{ bgcolor: 'secondary.200', p: 1.25, borderRadius: '50%' }}><Shield style={{ width: 20, height: 20, color: 'var(--mui-palette-secondary-main)' }} /></Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box><Typography variant="caption" fontWeight="500" color="text.secondary">Global Roles</Typography><Typography variant="h5" fontWeight="bold" color="primary.main">{stats.global}</Typography></Box>
                                <Box sx={{ bgcolor: 'primary.200', p: 1.25, borderRadius: '50%' }}><Key style={{ width: 20, height: 20, color: 'var(--mui-palette-primary-main)' }} /></Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box><Typography variant="caption" fontWeight="500" color="text.secondary">Tenant Roles</Typography><Typography variant="h5" fontWeight="bold" color="success.main">{stats.tenant}</Typography></Box>
                                <Box sx={{ bgcolor: 'success.200', p: 1.25, borderRadius: '50%' }}><Building2 style={{ width: 20, height: 20, color: 'var(--mui-palette-success-main)' }} /></Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box><Typography variant="caption" fontWeight="500" color="text.secondary">System Roles</Typography><Typography variant="h5" fontWeight="bold" color="warning.main">{stats.system}</Typography></Box>
                                <Box sx={{ bgcolor: 'warning.200', p: 1.25, borderRadius: '50%' }}><Shield style={{ width: 20, height: 20, color: 'var(--mui-palette-warning-main)' }} /></Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            <Stack direction="row" flexWrap="wrap" gap={2} alignItems="center" sx={{ mb: 1 }}>
                <TextField
                    size="small"
                    label="Guard"
                    placeholder="All guards"
                    value={filterGuard}
                    onChange={(e) => setFilterGuard(e.target.value)}
                    onBlur={() => loadRoles()}
                    onKeyDown={(e) => e.key === 'Enter' && loadRoles()}
                    sx={{ minWidth: 160 }}
                />
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="roles-tenant-filter-label">Tenant</InputLabel>
                    <Select
                        labelId="roles-tenant-filter-label"
                        label="Tenant"
                        value={filterTenantId}
                        onChange={(e) => {
                            const v = e.target.value as string;
                            setFilterTenantId(v);
                            loadRoles({ tenantId: v });
                        }}
                    >
                        <MenuItem value="">All tenants</MenuItem>
                        {tenants.map((t) => (
                            <MenuItem key={t.id} value={t.id}>{t.name || t.slug}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button size="small" variant="outlined" onClick={() => loadRoles()}>Apply filters</Button>
                {(filterGuard || filterTenantId) && (
                    <Button size="small" onClick={() => { setFilterGuard(''); setFilterTenantId(''); loadRoles({ guard: '', tenantId: '' }); }}>Clear</Button>
                )}
            </Stack>

            <Table
                columns={columns}
                data={roles}
                loading={loading}
                emptyMessage="No roles found"
                emptyIcon={<Shield style={{ width: 48, height: 48, color: 'var(--mui-palette-action-disabled)' }} />}
                rowKey={(role) => role.id}
            />

            <RoleDialog
                isOpen={showDialog}
                onClose={handleCloseDialog}
                onSubmit={handleSubmitRole}
                tenants={tenants}
                role={editingRole || undefined}
                error={dialogError}
            />
            <RolePermissionsDialog
                isOpen={!!permissionsDialogRole}
                onClose={() => setPermissionsDialogRole(null)}
                role={permissionsDialogRole}
                onSaved={() => loadRoles()}
            />
        </Box>
    );
};
