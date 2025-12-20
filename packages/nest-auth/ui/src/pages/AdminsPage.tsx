import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import type { Admin } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Table, Column } from '../components/Table';
import { Card } from '../components/Card';
import { CreateAdminDialog } from '../components/admin/CreateAdminDialog';
import type { AdminFormData } from '../components/admin/AdminForm';

export const AdminsPage: React.FC = () => {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createError, setCreateError] = useState('');
    const confirm = useConfirm();

    const loadAdmins = useCallback(async () => {
        try {
            setError('');
            setLoading(true);
            const { data } = await api.get<{ data: Admin[] }>('/admins');
            setAdmins(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAdmins();
    }, [loadAdmins]);

    const handleCreateAdmin = async (data: AdminFormData) => {
        setCreateError('');
        try {
            await api.post('/admins', {
                email: data.email.trim(),
                name: data.name.trim() || undefined,
                password: data.password,
            });
            setShowCreateModal(false);
            await loadAdmins();
        } catch (err: any) {
            setCreateError(err.message);
            throw err;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setError('');
            const confirmed = await confirm('Are you sure you want to delete this admin? This action cannot be undone.');
            if (!confirmed) {
                return;
            }
            await api.delete(`/admins/${id}`);
            await loadAdmins();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const stats = {
        total: admins.length,
        active: admins.length, // All admins are active
    };

    const columns: Column<Admin>[] = [
        {
            key: 'email',
            label: 'Admin',
            render: (admin) => (
                <div>
                    <div className="font-medium text-gray-900 text-sm">{admin.email}</div>
                    {admin.name && <div className="text-xs text-gray-500">{admin.name}</div>}
                </div>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            render: () => <span className="badge-success text-xs">Active</span>,
        },
        {
            key: 'lastLoginAt',
            label: 'Last Login',
            render: (admin) => (
                <span className="text-xs text-gray-500">
                    {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : '—'}
                </span>
            ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (admin) => (
                <span className="text-xs text-gray-500">
                    {admin.createdAt ? new Date(admin.createdAt).toLocaleString() : '—'}
                </span>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (admin) => (
                <div className="flex justify-end">
                    <Button size="sm" variant="danger" onClick={() => handleDelete(admin.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <PageHeader
                title="Admin Users"
                description="Manage dashboard admin accounts with access to the admin console"
                onRefresh={loadAdmins}
                loading={loading}
                action={
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4" />
                        Create Admin
                    </Button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200" padding="md">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-600 font-medium">Total Admins</p>
                            <p className="text-2xl font-bold text-purple-600">{stats.total}</p>
                        </div>
                        <div className="bg-purple-200 p-2.5 rounded-full">
                            <Eye className="w-5 h-5 text-purple-600" />
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

            {/* Admins Table */}
            <Table
                columns={columns}
                data={admins}
                loading={loading}
                emptyMessage="No admins found"
                emptyIcon={<Eye className="w-12 h-12 text-gray-300" />}
                rowKey={(admin) => admin.id}
            />

            <CreateAdminDialog
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                }}
                onSubmit={handleCreateAdmin}
                error={createError}
            />
        </div>
    );
};
