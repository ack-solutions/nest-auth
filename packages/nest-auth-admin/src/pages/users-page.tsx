import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Eye, Trash2, UserPlus, Building2, Shield, ShieldCheck, Globe } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/use-confirm';
import { useClientConfig } from '../hooks/use-client-config';
import { usePagination } from '../hooks/use-pagination';
import type { User, Tenant, Role } from '../types';
import { PageHeader } from '../components/page-header';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { Link, useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { Table, Column, PaginationInfo } from '../components/table';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { CreateUserDialog, UserFormData } from '../components/user/create-user-dialog';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const { tenantMode, platformAccessEnabled } = useClientConfig();
    const showTenants = tenantMode !== null;
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'verified' | 'unverified'>('all');
    const [filterTenant, setFilterTenant] = useState<string>('');
    const [filterRole, setFilterRole] = useState<string>('');
    // Access scope: platform users and tenant users are separate scopes on the
    // same user row, so this filters by which scope a user holds.
    const [filterScope, setFilterScope] = useState<'all' | 'platform' | 'tenant'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
    });
    const confirm = useConfirm();
    const navigate = useNavigate();
    const { page, limit, setPage } = usePagination({ initialPage: 1, initialLimit: 10 });

    const loadUsers = useCallback(async () => {
        try {
            setError('');
            setLoading(true);

            // Build query params
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            if (searchTerm) {
                params.append('search', searchTerm);
            }

            if (filterStatus !== 'all') {
                params.append('status', filterStatus);
            }

            if (showTenants && filterTenant) {
                params.append('tenantId', filterTenant);
            }

            if (filterRole) {
                params.append('roleName', filterRole);
            }

            if (filterScope !== 'all') {
                params.append('scope', filterScope);
            }

            const response = await api.get<{
                data: User[];
                meta?: {
                    page: number;
                    limit: number;
                    total: number;
                    totalPages: number;
                }
            }>(`/api/users?${params.toString()}`);

            const userList = Array.isArray(response.data) ? response.data : [];
            setUsers(userList);

            // Update pagination info
            if (response.meta) {
                setPagination(response.meta);
            } else {
                // Fallback if API doesn't return pagination
                setPagination({
                    page,
                    limit,
                    total: userList.length,
                    totalPages: Math.ceil(userList.length / limit),
                });
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchTerm, filterStatus, filterTenant, filterRole, filterScope, showTenants]);

    const loadTenants = useCallback(async () => {
        try {
            const { data } = await api.get<{ data: Tenant[] }>('/api/tenants');
            setTenants(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load tenants:', err);
        }
    }, []);

    const loadRoles = useCallback(async () => {
        try {
            const { data } = await api.get<{ data: Role[] }>('/api/roles');
            setRoles(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load roles:', err);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        loadTenants();
        loadRoles();
    }, [loadTenants, loadRoles]);

    useEffect(() => {
        if (!showTenants) {
            setFilterTenant('');
        }
    }, [showTenants]);

    const handleCreateUser = async (data: UserFormData) => {
        setCreateError('');
        try {
            const body: { email: string; tenantId?: string; isPlatformUser?: boolean } = { email: data.email.trim() };
            if (data.isPlatformUser) {
                // Platform users are tenant-less — never send a tenantId with one.
                body.isPlatformUser = true;
            } else if (tenantMode === 'isolated' && data.tenantId) {
                body.tenantId = data.tenantId;
            }
            await api.post('/api/users', body);
            setShowCreateModal(false);
            await loadUsers();
        } catch (err: any) {
            setCreateError(err.message);
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setError('');
            const confirmed = await confirm('Are you sure you want to delete this user? This action cannot be undone.');
            if (!confirmed) {
                return;
            }
            await api.delete(`/api/users/${id}`);
            await loadUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };


    useEffect(() => {
        const id = window.setTimeout(() => {
            setSearchTerm(searchInput);
            setPage(1);
        }, 300);
        return () => clearTimeout(id);
    }, [searchInput, setPage]);

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const stats = {
        total: pagination.total,
        active: users.filter((u) => u.isActive).length,
        verified: users.filter((u) => u.emailVerifiedAt || u.phoneVerifiedAt).length,
        inactive: users.filter((u) => !u.isActive).length,
    };

    const columns: Column<User>[] = [
        {
            key: 'email',
            label: 'User',
            render: (user) => (
                <Box>
                    <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" fontWeight={500}>{user.email}</Typography>
                        {user.isPlatformUser && (
                            <Chip
                                size="small"
                                icon={<Icon component={ShieldCheck} sx={{ fontSize: 12 }} />}
                                label="Platform"
                                color="primary"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                        )}
                    </Stack>
                    {user.phone && <Typography variant="caption" color="text.secondary">{user.phone}</Typography>}
                </Box>
            ),
        },
        ...(showTenants
            ? [
                {
                    key: 'tenantId',
                    label: 'Tenants',
                    render: (user) => {
                        const tenantNames = user.userAccesses?.map((a) => a.tenant?.name) ?? [];
                        return <Typography variant="body2">{tenantNames.join(', ')}</Typography>;
                    },
                },
            ]
            : []),
        {
            key: 'status',
            label: 'Status',
            render: (user) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={user.isActive ? 'Active' : 'Inactive'} color={user.isActive ? 'success' : 'error'} sx={{ height: 22 }} />
                    {user.emailVerifiedAt && <Chip size="small" label="Email Verified" color="info" sx={{ height: 22 }} />}
                    {user.phoneVerifiedAt && <Chip size="small" label="Phone Verified" color="info" sx={{ height: 22 }} />}
                </Stack>
            ),
        },
        {
            key: 'roles',
            label: 'Roles',
            render: (user) => {
                const accesses = user.userAccesses ?? [];
                const roleNames = accesses.flatMap((a) => (a.roles ?? []).map((r: any) => (typeof r === 'string' ? r : r.name)));
                // Platform roles live on a separate access row — never merge them
                // into the tenant role list, or a super-admin looks like a tenant role.
                const platformRoleNames = (user.platformAccess?.roles ?? []).map((r: any) => (typeof r === 'string' ? r : r.name));
                const totalRoles = roleNames.length;
                const tenantCount = accesses.filter((a) => a.tenantId != null).length;
                const hasAny = totalRoles > 0 || platformRoleNames.length > 0;
                return (
                    <Stack spacing={0.5}>
                        {platformRoleNames.length > 0 && (
                            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} alignItems="center">
                                <Icon component={Globe} sx={{ fontSize: 12, color: 'primary.main' }} />
                                {platformRoleNames.slice(0, 2).map((role, i) => (
                                    <Chip key={`platform-${role}-${i}`} size="small" label={role} sx={{ bgcolor: 'primary.50', color: 'primary.dark', fontSize: '0.75rem', height: 22 }} />
                                ))}
                                {platformRoleNames.length > 2 && <Typography variant="caption" color="text.secondary">+{platformRoleNames.length - 2}</Typography>}
                            </Stack>
                        )}
                        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} alignItems="center">
                            {totalRoles > 0 ? (
                                <>
                                    {roleNames.slice(0, 2).map((role, i) => (
                                        <Chip key={`${role}-${i}`} size="small" label={role} sx={{ bgcolor: 'secondary.50', color: 'secondary.dark', fontSize: '0.75rem', height: 22 }} />
                                    ))}
                                    {totalRoles > 2 && <Typography variant="caption" color="text.secondary">+{totalRoles - 2}</Typography>}
                                    {showTenants && tenantCount > 1 && <Typography variant="caption" color="text.disabled">· {tenantCount} tenants</Typography>}
                                </>
                            ) : (
                                !hasAny && <Typography variant="body2" color="text.disabled">No roles</Typography>
                            )}
                        </Stack>
                    </Stack>
                );
            },
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (user) => (
                <Typography variant="body2" color="text.secondary">{new Date(user.createdAt).toLocaleDateString()}</Typography>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (user) => (
                <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                    <IconButton
                        component={Link}
                        to={`/users/${user.id}`}
                        size="small"
                        color="inherit"
                        aria-label="View user"
                        onClick={(e) => {  e.stopPropagation(); }}
                    >
                        <Icon component={Eye} />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(user.id)} aria-label="Delete user">
                        <Icon component={Trash2} />
                    </IconButton>
                </Stack>
            ),
        },
    ];

    return (
        <>
            <Stack spacing={2}>
                <PageHeader
                    title="User Management"
                    description="Manage application users, roles, and permissions"
                    onRefresh={loadUsers}
                    loading={loading}
                    action={
                        <Button variant="contained" color="primary" onClick={() => setShowCreateModal(true)} startIcon={<Icon component={UserPlus} />}>
                            Create User
                        </Button>
                    }
                />

                {/* Stats Cards */}
                <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack spacing={0.25}>
                                        <Typography variant="caption" fontWeight="500" color="text.secondary">Total Users</Typography>
                                        <Typography variant="h5" fontWeight="bold" color="primary.main">{stats.total}</Typography>
                                    </Stack>
                                    <Box sx={{ bgcolor: 'primary.200', p: 1.25, borderRadius: '50%' }}><Icon component={UserPlus} sx={{ fontSize: 20, color: 'primary.main' }} /></Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack spacing={0.25}>
                                        <Typography variant="caption" fontWeight="500" color="text.secondary">Active</Typography>
                                        <Typography variant="h5" fontWeight="bold" color="success.main">{stats.active}</Typography>
                                    </Stack>
                                    <Box sx={{ bgcolor: 'success.200', p: 1.25, borderRadius: '50%' }}><Icon component={CheckCircle} sx={{ fontSize: 20, color: 'success.main' }} /></Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack spacing={0.25}>
                                        <Typography variant="caption" fontWeight="500" color="text.secondary">Verified</Typography>
                                        <Typography variant="h5" fontWeight="bold" color="secondary.main">{stats.verified}</Typography>
                                    </Stack>
                                    <Box sx={{ bgcolor: 'secondary.200', p: 1.25, borderRadius: '50%' }}><Icon component={CheckCircle} sx={{ fontSize: 20, color: 'secondary.main' }} /></Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Stack spacing={0.25}>
                                        <Typography variant="caption" fontWeight="500" color="text.secondary">Inactive</Typography>
                                        <Typography variant="h5" fontWeight="bold" color="error.main">{stats.inactive}</Typography>
                                    </Stack>
                                    <Box sx={{ bgcolor: 'error.200', p: 1.25, borderRadius: '50%' }}><Icon component={XCircle} sx={{ fontSize: 20, color: 'error.main' }} /></Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Search and Filter Bar */}
                <Card>
                    <CardContent>
                        <Stack spacing={1.5}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} useFlexGap flexWrap="wrap" >
                                <TextField
                                    fullWidth
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search users..."
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" color="action" />
                                                </InputAdornment>
                                            ),
                                            endAdornment: searchInput ? (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setSearchInput('')}
                                                        aria-label="Clear search"
                                                    >
                                                        <ClearIcon fontSize="small" />
                                                    </IconButton>
                                                </InputAdornment>
                                            ) : null,
                                        },
                                    }}
                                    sx={{ flex: 1, minWidth: 200 }}
                                />

                                <Stack direction="row" alignItems="center" spacing={1.5} useFlexGap >
                                    {platformAccessEnabled && (
                                        <TextField
                                            select
                                            sx={{ minWidth: 160 }}
                                            value={filterScope}
                                            onChange={(e) => { setFilterScope(e.target.value as typeof filterScope); setPage(1); }}
                                            helperText="Access scope"
                                            SelectProps={{ displayEmpty: true }}
                                        >
                                            <MenuItem value="all">All users</MenuItem>
                                            <MenuItem value="platform">Platform users</MenuItem>
                                            <MenuItem value="tenant">Non-platform users</MenuItem>
                                        </TextField>
                                    )}
                                    <TextField
                                        select
                                        sx={{ minWidth: 130 }}
                                        value={filterStatus}
                                        onChange={(e) => { setFilterStatus(e.target.value as typeof filterStatus); setPage(1); }}
                                    >
                                        <MenuItem value="all">Status</MenuItem>
                                        <MenuItem value="active">Active</MenuItem>
                                        <MenuItem value="inactive">Inactive</MenuItem>
                                        <MenuItem value="verified">Verified</MenuItem>
                                        <MenuItem value="unverified">Unverified</MenuItem>
                                    </TextField>
                                    {showTenants && (
                                        <TextField
                                            select
                                            sx={{ minWidth: 160 }}
                                            value={filterTenant}
                                            onChange={(e) => { setFilterTenant(e.target.value); setPage(1); }}
                                            SelectProps={{ displayEmpty: true }}
                                        >
                                            <MenuItem value=""><em>Tenant</em></MenuItem>
                                            {tenants.map((t) => (
                                                <MenuItem key={t.id} value={t.id}>{t.name || t.slug || t.id}</MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                    <TextField
                                        select
                                        sx={{ minWidth: 180 }}
                                        value={filterRole}
                                        onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
                                        SelectProps={{ displayEmpty: true }}
                                    >
                                        <MenuItem value=""><em>Role</em></MenuItem>
                                        {roles.map((r) => (
                                            <MenuItem key={r.id} value={r.name}>{`${r.name} (${r.guard})`}</MenuItem>
                                        ))}
                                    </TextField>
                                    {(filterStatus !== 'all' || (showTenants && filterTenant) || filterRole || filterScope !== 'all') && (
                                        <Button size="small" onClick={() => { setFilterStatus('all'); setFilterTenant(''); setFilterRole(''); setFilterScope('all'); setPage(1); }} sx={{ typography: 'body2', fontWeight: 500, flexShrink: 0 }}>
                                            Clear all
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                            {(filterStatus !== 'all' || (showTenants && filterTenant) || filterRole || filterScope !== 'all') && (
                                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} alignItems="center" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                                    <Typography variant="caption" fontWeight={500} color="text.secondary">Active:</Typography>
                                    {filterScope !== 'all' && (
                                        <Chip
                                            size="small"
                                            icon={<Icon component={Globe} sx={{ fontSize: 12 }} />}
                                            label={filterScope === 'platform' ? 'Platform users' : 'Non-platform users'}
                                            onDelete={() => { setFilterScope('all'); setPage(1); }}
                                            color="primary"
                                            sx={{ height: 24 }}
                                        />
                                    )}
                                    {filterStatus !== 'all' && (
                                        <Chip size="small" label={filterStatus} onDelete={() => { setFilterStatus('all'); setPage(1); }} color="primary" sx={{ height: 24 }} />
                                    )}
                                    {showTenants && filterTenant && (
                                        <Chip size="small" icon={<Icon component={Building2} sx={{ fontSize: 12 }} />} label={tenants.find(t => t.id === filterTenant)?.name || 'Tenant'} onDelete={() => { setFilterTenant(''); setPage(1); }} sx={{ height: 24, bgcolor: 'secondary.50', color: 'secondary.dark' }} />
                                    )}
                                    {filterRole && (
                                        <Chip size="small" icon={<Icon component={Shield} sx={{ fontSize: 12 }} />} label={filterRole} onDelete={() => { setFilterRole(''); setPage(1); }} sx={{ height: 24, bgcolor: 'success.50', color: 'success.dark' }} />
                                    )}
                                </Stack>
                            )}
                        </Stack>
                    </CardContent>
                </Card>

                {error && (
                    <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
                )}

                {/* Users Table */}
                <Table
                    columns={columns}
                    data={users}
                    loading={loading}
                    emptyMessage="No users found"
                    emptyIcon={<Icon component={UserPlus} sx={{ fontSize: 64, color: 'action.disabled' }} />}
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onRowClick={(user) => navigate(`/users/${user.id}`)}
                    rowKey={(user) => user.id}
                />

                <CreateUserDialog
                    open={showCreateModal}
                    onClose={() => {
                        setShowCreateModal(false);
                        setCreateError('');
                    }}
                    onSubmit={handleCreateUser}
                    tenantMode={tenantMode}
                    tenants={tenants}
                    roles={roles}
                    platformAccessEnabled={platformAccessEnabled}
                    error={createError}
                />
            </Stack>
        </>
    );
};
