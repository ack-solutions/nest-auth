import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Building2, Key, Edit2 } from 'lucide-react';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import type { Role, Tenant } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Table, Column } from '../components/Table';
import { Card } from '../components/Card';
import { RoleDialog } from '../components/role/RoleDialog';
import type { RoleFormData } from '../components/role/RoleDialog';

export const RolesPage: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [error, setError] = useState('');
    const [dialogError, setDialogError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const confirm = useConfirm();

    const loadRoles = useCallback(async () => {
        try {
            setError('');
            setLoading(true);
            const { data } = await api.get<{ data: Role[] }>('/api/roles');
            setRoles(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadTenants = useCallback(async () => {
        try {
            const { data } = await api.get<{ data: Tenant[] }>('/api/tenants');
            setTenants(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('Failed to load tenants:', err);
        }
    }, []);

    useEffect(() => {
        loadRoles();
        loadTenants();
    }, [loadRoles, loadTenants]);

    const handleSubmitRole = async (data: RoleFormData) => {
        setDialogError('');
        try {
            const payload: any = {
                name: data.name.trim(),
                guard: data.guard.trim() || 'web',
                permissions: data.permissions,
            };

            if (editingRole) {
                // Edit mode
                await api.patch(`/api/roles/${editingRole.id}`, payload);
            } else {
                // Create mode
                if (data.tenantId) {
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
                <div>
                    <div className="font-medium text-gray-900 text-sm">{role.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                        Guard: <span className="badge bg-purple-100 text-purple-800 text-xs">{role.guard}</span>
                    </div>
                </div>
            ),
        },
        {
            key: 'permissions',
            label: 'Permissions',
            render: (role) => (
                <span className="text-xs text-gray-600">
                    {role.permissions?.length || 0} permission{(role.permissions?.length || 0) !== 1 ? 's' : ''}
                </span>
            ),
        },
        {
            key: 'type',
            label: 'Type',
            render: (role) => {
                if (role.isSystem) {
                    return <span className="badge bg-amber-100 text-amber-800 text-xs">System</span>;
                }
                if (role.tenantId) {
                    return <span className="badge bg-green-100 text-green-800 text-xs">Tenant</span>;
                }
                return <span className="badge bg-blue-100 text-blue-800 text-xs">Global</span>;
            },
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (role) => (
                <span className="text-xs text-gray-500">
                    {new Date(role.createdAt).toLocaleDateString()}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (role) => (
                <div className="flex items-center justify-end gap-2">
                    {!role.isSystem && (
                        <Button size="sm" variant="secondary" onClick={() => handleEdit(role)}>
                            <Edit2 className="w-4 h-4" />
                        </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => handleDelete(role.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <PageHeader
                title="Role Management"
                description="Define permissions and manage access control across your application"
                onRefresh={loadRoles}
                loading={loading}
                action={
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4" />
                        Create Role
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Total Roles</p>
                            <p className="text-2xl font-bold text-purple-600">{stats.total}</p>
                        </div>
                        <div className="bg-purple-200 p-2.5 rounded-full">
                            <Shield className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Global Roles</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.global}</p>
                        </div>
                        <div className="bg-blue-200 p-2.5 rounded-full">
                            <Key className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Tenant Roles</p>
                            <p className="text-2xl font-bold text-green-600">{stats.tenant}</p>
                        </div>
                        <div className="bg-green-200 p-2.5 rounded-full">
                            <Building2 className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">System Roles</p>
                            <p className="text-2xl font-bold text-amber-600">{stats.system}</p>
                        </div>
                        <div className="bg-amber-200 p-2.5 rounded-full">
                            <Shield className="w-5 h-5 text-amber-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Roles Table */}
            <Table
                columns={columns}
                data={roles}
                loading={loading}
                emptyMessage="No roles found"
                emptyIcon={<Shield className="w-12 h-12 text-gray-300" />}
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
        </div>
    );
};
