import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Building2, Edit2 } from 'lucide-react';
import { api } from '../services/api';
import { useConfirm } from '../hooks/use-confirm';
import type { Tenant } from '../types';
import { PageHeader } from '../components/page-header';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { Table, Column } from '../components/table';
import { CreateTenantDialog } from '../components/tenant/create-tenant-dialog';
import { EditTenantDialog } from '../components/tenant/edit-tenant-dialog';
import type { TenantFormData } from '../components/tenant/tenant-form';

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
                <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                    <IconButton size="small" color="inherit" onClick={() => handleEdit(tenant)} aria-label="Edit tenant">
                        <Edit2 style={{ width: 20, height: 20 }} />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(tenant.id)} aria-label="Delete tenant">
                        <Trash2 style={{ width: 20, height: 20 }} />
                    </IconButton>
                </Stack>
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
                    <Button variant="contained" color="primary" onClick={() => setShowCreateModal(true)} startIcon={<Plus style={{ width: 20, height: 20 }} />}>
                        Create Tenant
                    </Button>
                }
            />

            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

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
