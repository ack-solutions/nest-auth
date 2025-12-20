import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Edit2, X, Search, Filter } from 'lucide-react';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import type { Permission } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Table, Column, PaginationInfo } from '../components/Table';
import { Card } from '../components/Card';
import { SearchInput } from '../components/SearchInput';
import { CreatePermissionDialog } from '../components/permission/CreatePermissionDialog';
import { EditPermissionDialog } from '../components/permission/EditPermissionDialog';
import type { PermissionFormData } from '../components/permission/PermissionForm';

export const PermissionsPage: React.FC = () => {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [updateError, setUpdateError] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [selectedGuard, setSelectedGuard] = useState<string>('all');
    const [guards, setGuards] = useState<string[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
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

    const loadGuards = useCallback(async () => {
        try {
            const { data } = await api.get<{ data: string[] }>('/api/permissions/guards');
            setGuards(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load guards:', err);
        }
    }, []);

    useEffect(() => {
        loadPermissions();
        loadCategories();
        loadGuards();
    }, [loadPermissions, loadCategories, loadGuards]);

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
            await loadGuards();
        } catch (err: any) {
            setCreateError(err.message || 'Failed to create permission');
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setError('');
            const confirmed = await confirm('Are you sure you want to delete this permission? Note: This will not remove it from roles that already use it, but it will no longer appear in autocomplete suggestions.');
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
                payload.updateInRoles = data.updateInRoles || false;
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
            await loadGuards();
        } catch (err: any) {
            setUpdateError(err.message || 'Failed to update permission');
            throw err;
        }
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (newPage: number) => {
        setPagination((prev) => ({ ...prev, page: newPage }));
    };

    const columns: Column<Permission>[] = [
        {
            key: 'name',
            label: 'Permission Name',
            render: (permission) => (
                <div>
                    <span className="font-medium text-gray-900">{permission.name}</span>
                </div>
            ),
        },
        {
            key: 'description',
            label: 'Description',
            render: (permission) => (
                <span className="text-sm text-gray-600">
                    {permission.description || <span className="text-gray-400">—</span>}
                </span>
            ),
        },
        {
            key: 'guard',
            label: 'Guard',
            render: (permission) => (
                <span className="badge bg-purple-100 text-purple-800 text-xs">
                    {permission.guard || 'web'}
                </span>
            ),
        },
        {
            key: 'category',
            label: 'Category',
            render: (permission) => (
                permission.category ? (
                    <span className="badge bg-blue-100 text-blue-800 text-xs">
                        {permission.category}
                    </span>
                ) : (
                    <span className="text-gray-400 text-sm">—</span>
                )
            ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (permission) => (
                <span className="text-sm text-gray-500">
                    {new Date(permission.createdAt).toLocaleDateString()}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (permission) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEdit(permission)}
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(permission.id)}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <PageHeader
                title="Permission Registry"
                description="Manage permission registry for autocomplete and suggestions. Permissions in roles are stored as JSON strings and are independent of this registry."
                onRefresh={loadPermissions}
                loading={loading}
                action={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4" />
                        Create Permission
                    </Button>
                }
            />

            {/* Guard Tabs */}
            {guards.length > 0 && (
                <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedGuard('all');
                            setPagination((prev) => ({ ...prev, page: 1 }));
                        }}
                        className={`px-4 py-2 whitespace-nowrap rounded-t-lg font-medium transition-colors ${selectedGuard === 'all'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        All Guards
                    </button>
                    {guards.map((guard) => (
                        <button
                            key={guard}
                            type="button"
                            onClick={() => {
                                setSelectedGuard(guard);
                                setPagination((prev) => ({ ...prev, page: 1 }));
                            }}
                            className={`px-4 py-2 whitespace-nowrap rounded-t-lg font-medium transition-colors ${selectedGuard === guard
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {guard}
                        </button>
                    ))}
                </div>
            )}

            {/* Search and Filter Bar */}
            <Card padding="md">
                <div className="flex flex-col md:flex-row gap-3">
                    <SearchInput
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Search permissions..."
                        className="flex-1"
                    />
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <select
                            value={filterCategory}
                            onChange={(e) => {
                                setFilterCategory(e.target.value);
                                setPagination((prev) => ({ ...prev, page: 1 }));
                            }}
                            className="input-field w-48"
                        >
                            <option value="all">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Permissions Table */}
            <Table
                columns={columns}
                data={permissions}
                loading={loading}
                emptyMessage="No permissions found"
                emptyIcon={<Key className="w-16 h-16 text-gray-300" />}
                pagination={pagination}
                onPageChange={handlePageChange}
                rowKey={(permission) => permission.id}
            />

            <CreatePermissionDialog
                isOpen={showCreateModal}
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
                    isOpen={!!editingPermission}
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
        </div>
    );
};
