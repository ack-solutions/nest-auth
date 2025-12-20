import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Building2, Edit2 } from 'lucide-react';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import type { Tenant } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Table, Column } from '../components/Table';
import { Card } from '../components/Card';
import { CreateTenantDialog } from '../components/tenant/CreateTenantDialog';
import { EditTenantDialog } from '../components/tenant/EditTenantDialog';
import type { TenantFormData } from '../components/tenant/TenantForm';

export const TenantsPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [updateError, setUpdateError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const confirm = useConfirm();

    const loadTenants = useCallback(async () => {
        try {
            setError('');
            setLoading(true);
            const { data } = await api.get<{ data: Tenant[] }>('/api/tenants');
            setTenants(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTenants();
    }, [loadTenants]);

    const handleCreateTenant = async (data: TenantFormData) => {
        setCreateError('');
        try {
            await api.post('/api/tenants', {
                name: data.name.trim(),
                slug: data.slug.trim(),
                description: data.description?.trim() || undefined,
            });
            setShowCreateModal(false);
            await loadTenants();
        } catch (err: any) {
            setCreateError(err.message);
            throw err;
        }
    };

    const handleUpdateTenant = async (data: TenantFormData) => {
        if (!editingTenant) return;
        setUpdateError('');
        try {
            await api.patch(`/api/tenants/${editingTenant.id}`, {
                name: data.name.trim(),
                slug: data.slug.trim(),
                description: data.description?.trim() || undefined,
            });
            setEditingTenant(null);
            await loadTenants();
        } catch (err: any) {
            setUpdateError(err.message);
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setError('');
            const confirmed = await confirm('Are you sure you want to delete this tenant? This action cannot be undone.');
            if (!confirmed) {
                return;
            }
            await api.delete(`/api/tenants/${id}`);
            await loadTenants();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleEdit = (tenant: Tenant) => {
        setEditingTenant(tenant);
        setUpdateError('');
    };

    const handleCloseEdit = () => {
        setEditingTenant(null);
        setUpdateError('');
    };

    const columns: Column<Tenant>[] = [
        {
            key: 'name',
            label: 'Tenant Name',
            render: (tenant) => (
                <span className="font-medium text-gray-900 text-sm">{tenant.name}</span>
            ),
        },
        {
            key: 'slug',
            label: 'Slug',
            render: (tenant) => <span className="badge-info text-xs">{tenant.slug}</span>,
        },
        {
            key: 'description',
            label: 'Description',
            render: (tenant) => (
                <span className="text-xs text-gray-600">
                    {tenant.description || '—'}
                </span>
            ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (tenant) => (
                <span className="text-xs text-gray-500">
                    {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (tenant) => (
                <div className="flex justify-end gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEdit(tenant)}
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(tenant.id)}
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
                title="Tenant Management"
                description="Manage workspace isolation with multi-tenant support"
                onRefresh={loadTenants}
                loading={loading}
                action={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4" />
                        Create Tenant
                    </Button>
                }
            />

            {/* Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Total Tenants</p>
                            <p className="text-2xl font-bold text-indigo-600">{tenants.length}</p>
                        </div>
                        <div className="bg-indigo-200 p-2.5 rounded-full">
                            <Building2 className="w-5 h-5 text-indigo-600" />
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

            {/* Tenants Table */}
            <Table
                columns={columns}
                data={tenants}
                loading={loading}
                emptyMessage="No tenants found"
                emptyIcon={<Building2 className="w-12 h-12 text-gray-300" />}
                rowKey={(tenant) => tenant.id}
            />

            <CreateTenantDialog
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                }}
                onSubmit={handleCreateTenant}
                error={createError}
            />

            {editingTenant && (
                <EditTenantDialog
                    isOpen={!!editingTenant}
                    onClose={handleCloseEdit}
                    onSubmit={handleUpdateTenant}
                    tenant={editingTenant}
                    error={updateError}
                />
            )}
        </div>
    );
};
