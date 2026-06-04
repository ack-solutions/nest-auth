import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Pencil } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/use-confirm';
import type { Permission } from '../types';
import { PageHeader } from '../components/page-header';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { Table, Column, PaginationInfo } from '../components/table';
import { CreatePermissionDialog } from '../components/permission/create-permission-dialog';
import { EditPermissionDialog } from '../components/permission/edit-permission-dialog';
import type { PermissionFormData } from '../components/permission/permission-form';
import { useClientConfig } from '@/hooks/use-client-config';

export const PermissionsPage: React.FC = () => {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [updateError, setUpdateError] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [selectedGuard, setSelectedGuard] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { roleGuards } = useClientConfig();
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });
    const confirm = useConfirm();

    const loadPermissions = useCallback(async () => {
        try {
            setError('');
            setLoading(true);
            const params = new URLSearchParams();
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            if (filterCategory !== 'all') {
                params.append('category', filterCategory);
            }
            if (selectedGuard !== 'all') {
                params.append('guard', selectedGuard);
            }
            if (pagination.limit) {
                params.append('limit', pagination.limit.toString());
            }

            const { data } = await api.get<{ data: Permission[] }>(`/api/permissions?${params.toString()}`);
            setPermissions(Array.isArray(data) ? data : []);
            setPagination((prev) => ({
                ...prev,
                total: Array.isArray(data) ? data.length : 0,
                totalPages: Math.ceil((Array.isArray(data) ? data.length : 0) / prev.limit),
            }));
        } catch (err: any) {
            setError(err.message || 'Failed to load permissions');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterCategory, selectedGuard, pagination.limit]);

    const loadCategories = useCallback(async () => {
        try {
            const { data } = await api.get<{ data: string[] }>('/api/permissions/categories');
            setCategories(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load categories:', err);
        }
    }, []);

    useEffect(() => {
        loadPermissions();
        loadCategories();
    }, [loadPermissions, loadCategories]);

    useEffect(() => {
        const id = window.setTimeout(() => {
            setSearchTerm(searchInput);
            setPagination((prev) => ({ ...prev, page: 1 }));
        }, 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    const handleCreatePermission = async (data: PermissionFormData) => {
        setCreateError('');
        try {
            const payload: any = {
                name: data.name.trim(),
                guard: data.guard.trim() || 'web',
            };
            if (data.description?.trim()) {
                payload.description = data.description.trim();
            }
            if (data.category?.trim()) {
                payload.category = data.category.trim();
            }

            await api.post('/api/permissions', payload);
            setShowCreateModal(false);
            await loadPermissions();
            await loadCategories();
        } catch (err: any) {
            setCreateError(err.message || 'Failed to create permission');
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setError('');
            const confirmed = await confirm('Are you sure you want to delete this permission? This will also remove it from any roles that currently use it.');
            if (!confirmed) {
                return;
            }
            await api.delete(`/api/permissions/${id}`);
            await loadPermissions();
            await loadCategories();
        } catch (err: any) {
            setError(err.message || 'Failed to delete permission');
        }
    };

    const handleEdit = (permission: Permission) => {
        setEditingPermission(permission);
        setUpdateError('');
    };

    const handleUpdatePermission = async (data: PermissionFormData) => {
        if (!editingPermission) return;

        setUpdateError('');
        try {
            const payload: any = {};
            if (data.name.trim() !== editingPermission.name) {
                payload.name = data.name.trim();
            }
            if (data.guard.trim() !== editingPermission.guard) {
                payload.guard = data.guard.trim();
            }
            if (data.description?.trim() !== (editingPermission.description || '')) {
                payload.description = data.description?.trim() || null;
            }
            if (data.category?.trim() !== (editingPermission.category || '')) {
                payload.category = data.category?.trim() || null;
            }

            await api.patch(`/api/permissions/${editingPermission.id}`, payload);
            setEditingPermission(null);
            await loadPermissions();
            await loadCategories();
        } catch (err: any) {
            setUpdateError(err.message || 'Failed to update permission');
            throw err;
        }
    };

    const handlePageChange = (newPage: number) => {
        setPagination((prev) => ({ ...prev, page: newPage }));
    };

    const categoryOptions: Array<{ value: string; label: string }> = [
        { value: 'all', label: 'All Categories' },
        ...categories.map((cat) => ({ value: cat, label: cat })),
    ];

    const guardFilterOptions: Array<{ value: string; label: string }> = [
        { value: 'all', label: 'All Guards' },
        ...roleGuards.map((opt) => ({ value: opt, label: opt })),
    ];

    const columns: Column<Permission>[] = [
        {
            key: 'name',
            label: 'Permission Name',
            render: (permission) => (
                <Typography variant="body2" fontWeight="medium" color="text.primary">
                    {permission.name}
                </Typography>
            ),
        },
        {
            key: 'description',
            label: 'Description',
            render: (permission) => (
                <Typography variant="body2" color="text.secondary">
                    {permission.description ?? '—'}
                </Typography>
            ),
        },
        {
            key: 'guard',
            label: 'Guard',
            render: (permission) => (
                <Chip
                    size="small"
                    label={permission.guard || 'web'}
                    sx={{
                        height: 24,
                        bgcolor: 'action.selected',
                        color: 'text.primary',
                    }}
                />
            ),
        },
        {
            key: 'category',
            label: 'Category',
            render: (permission) =>
                permission.category ? (
                    <Chip
                        size="small"
                        label={permission.category}
                        color="primary"
                        variant="outlined"
                        sx={{ height: 24 }}
                    />
                ) : (
                    <Typography variant="body2" color="text.disabled">
                        —
                    </Typography>
                ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (permission) => (
                <Typography variant="body2" color="text.secondary">
                    {new Date(permission.createdAt).toLocaleDateString()}
                </Typography>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (permission) => (
                <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={() => handleEdit(permission)}
                        aria-label="Edit permission"
                    >
                        <Icon component={Pencil} />
                    </IconButton>
                    <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(permission.id)}
                        aria-label="Delete permission"
                    >
                        <Icon component={Trash2} />
                    </IconButton>
                </Stack>
            ),
        },
    ];

    return (
        <Stack spacing={3}>
            <PageHeader
                title="Permission Registry"
                description="Manage the permission registry used by role-permission assignments across your application."
                onRefresh={loadPermissions}
                loading={loading}
                action={
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => setShowCreateModal(true)}
                        startIcon={<Icon component={Plus} />}
                    >
                        Create Permission
                    </Button>
                }
            />

            {/* Search and filter bar */}
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TextField
                            fullWidth
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search permissions..."
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
                        />
                    </Box>
                    <Box sx={{ minWidth: { sm: 160 }, maxWidth: { sm: 240 } }}>
                        <TextField
                            select
                            fullWidth
                            label="Guard"
                            value={selectedGuard}
                            onChange={(e) => {
                                setSelectedGuard(e.target.value);
                                setPagination((prev) => ({ ...prev, page: 1 }));
                            }}
                        >
                            {guardFilterOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>
                    <Box sx={{ minWidth: { sm: 200 }, maxWidth: { sm: 280 } }}>
                        <TextField
                            select
                            fullWidth
                            label="Category"
                            value={filterCategory}
                            onChange={(e) => {
                                setFilterCategory(e.target.value);
                                setPagination((prev) => ({ ...prev, page: 1 }));
                            }}
                        >
                            {categoryOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>
                </Stack>
            </Paper>

            {error && (
                <Alert severity="error" onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <Table
                columns={columns}
                data={permissions}
                loading={loading}
                emptyMessage="No permissions found"
                emptyIcon={<Icon component={Key} sx={{ fontSize: 64, color: 'action.disabled' }} />}
                pagination={pagination}
                onPageChange={handlePageChange}
                rowKey={(permission) => permission.id}
            />

            <CreatePermissionDialog
                open={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                }}
                onSubmit={handleCreatePermission}
                categories={categories}
                error={createError}
            />

            {editingPermission && (
                <EditPermissionDialog
                    open={!!editingPermission}
                    onClose={() => {
                        setEditingPermission(null);
                        setUpdateError('');
                    }}
                    onSubmit={handleUpdatePermission}
                    permission={editingPermission}
                    categories={categories}
                    error={updateError}
                />
            )}
        </Stack>
    );
};
