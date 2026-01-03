import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Eye, Trash2, UserPlus, Filter } from 'lucide-react';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import { usePagination } from '../hooks/usePagination';
import type { User, CreateUserForm, Tenant, Role } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { UserDetailModal } from '../components/user/UserDetailModal';
import { Select } from '../components/Select';
import { MultiSelect } from '../components/MultiSelect';
import { SearchInput } from '../components/SearchInput';
import { Table, Column, PaginationInfo } from '../components/Table';
import { Card } from '../components/Card';
import { CreateUserDialog } from '../components/user/CreateUserDialog';
import { UserFormData, roleKeysToAssignments } from '../components/user/UserForm';

export const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'verified' | 'unverified'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
    });
    const confirm = useConfirm();
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
    }, [page, limit, searchTerm, filterStatus]);

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

    const handleCreateUser = async (data: UserFormData) => {
        setCreateError('');
        try {
            // Convert role keys (name:guard) to RoleAssignment objects
            const roleAssignments = roleKeysToAssignments(data.roles || []);
            
            await api.post('/api/users', {
                email: data.email.trim(),
                tenantId: data.tenantId || undefined,
                password: data.password || undefined,
                roles: roleAssignments,
            });
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

    const handleUpdateUser = async (id: string, updates: Partial<User>) => {
        try {
            await api.patch(`/api/users/${id}`, updates);
            await loadUsers();
            setSelectedUser(null);
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        setPage(1); // Reset to first page on search
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const stats = {
        total: pagination.total,
        active: users.filter((u) => u.isActive).length,
        verified: users.filter((u) => u.isVerified).length,
        inactive: users.filter((u) => !u.isActive).length,
    };

    const columns: Column<User>[] = [
        {
            key: 'email',
            label: 'User',
            render: (user) => (
                <div>
                    <div className="font-medium text-gray-900">{user.email}</div>
                    {user.phone && <div className="text-sm text-gray-500">{user.phone}</div>}
                </div>
            ),
        },
        {
            key: 'tenantId',
            label: 'Tenant',
            render: (user) => (
                <span className="text-sm text-gray-900">{user.tenantId || '—'}</span>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: (user) => (
                <div className="flex flex-col gap-1">
                    {user.isActive ? (
                        <span className="badge-success">Active</span>
                    ) : (
                        <span className="badge-danger">Inactive</span>
                    )}
                    {user.isVerified && <span className="badge-info">Verified</span>}
                </div>
            ),
        },
        {
            key: 'roles',
            label: 'Roles',
            render: (user) => (
                <div className="flex flex-wrap gap-1">
                    {user.roles.length > 0 ? (
                        user.roles.slice(0, 2).map((role) => (
                            <span key={role} className="badge bg-purple-100 text-purple-800 text-xs">
                                {role}
                            </span>
                        ))
                    ) : (
                        <span className="text-sm text-gray-400">No roles</span>
                    )}
                    {user.roles.length > 2 && (
                        <span className="text-xs text-gray-500">+{user.roles.length - 2}</span>
                    )}
                </div>
            ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (user) => (
                <span className="text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (user) => (
                <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedUser(user)}>
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(user.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <PageHeader
                title="User Management"
                description="Manage application users, roles, and permissions"
                onRefresh={loadUsers}
                loading={loading}
                action={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <UserPlus className="w-4 h-4" />
                        Create User
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Total Users</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                        </div>
                        <div className="bg-blue-200 p-2.5 rounded-full">
                            <UserPlus className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Active</p>
                            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                        </div>
                        <div className="bg-green-200 p-2.5 rounded-full">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Verified</p>
                            <p className="text-2xl font-bold text-purple-600">{stats.verified}</p>
                        </div>
                        <div className="bg-purple-200 p-2.5 rounded-full">
                            <CheckCircle className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Inactive</p>
                            <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
                        </div>
                        <div className="bg-red-200 p-2.5 rounded-full">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search and Filter Bar */}
            <Card padding="md">
                <div className="flex flex-col md:flex-row gap-3">
                    <SearchInput
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Search by email, phone, or tenant..."
                        className="flex-1"
                    />
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <select
                            value={filterStatus}
                            onChange={(e) => {
                                setFilterStatus(e.target.value as any);
                                setPage(1);
                            }}
                            className="input-field w-48"
                        >
                            <option value="all">All Users</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Inactive Only</option>
                            <option value="verified">Verified Only</option>
                            <option value="unverified">Unverified Only</option>
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

            {/* Users Table */}
            <Table
                columns={columns}
                data={users}
                loading={loading}
                emptyMessage="No users found"
                emptyIcon={<UserPlus className="w-16 h-16 text-gray-300" />}
                pagination={pagination}
                onPageChange={handlePageChange}
                rowKey={(user) => user.id}
            />

            <CreateUserDialog
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                }}
                onSubmit={handleCreateUser}
                tenants={tenants}
                roles={roles}
                error={createError}
            />

            {/* User Detail Modal */}
            {selectedUser && (
                <UserDetailModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onUpdate={handleUpdateUser}
                />
            )}
        </div>
    );
};
