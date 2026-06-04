import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/use-confirm';
import type { Admin } from '../types';
import { PageHeader } from '../components/page-header';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { Table, Column } from '../components/table';
import { CreateAdminDialog } from '../components/admin/create-admin-dialog';
import type { AdminFormData } from '../components/admin/admin-form';

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
                <Stack direction="row" justifyContent="flex-end">
                    <IconButton size="small" color="error" onClick={() => handleDelete(admin.id)} aria-label="Delete admin">
                        <Icon component={Trash2} />
                    </IconButton>
                </Stack>
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
                    <Button variant="contained" color="primary" onClick={() => setShowCreateModal(true)} startIcon={<Icon component={Plus} />}>
                        Create Admin
                    </Button>
                }
            />

            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            {/* Admins Table */}
            <Table
                columns={columns}
                data={admins}
                loading={loading}
                emptyMessage="No admins found"
                emptyIcon={<Icon component={Eye} sx={{ fontSize: 48, color: 'action.disabled' }} />}
                rowKey={(admin) => admin.id}
            />

            <CreateAdminDialog
                open={showCreateModal}
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
