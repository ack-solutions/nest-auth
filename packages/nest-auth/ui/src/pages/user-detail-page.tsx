import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { ArrowLeft } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { PageHeader } from '../components/page-header';
import { UserDetailView } from '../components/user/user-detail-view';
import { useClientConfig } from '../hooks/use-client-config';
import { api } from '../services/api';
import type { UserDetails, Role, Tenant } from '../types';

export type TenantMode = 'isolated' | 'shared' | null;

export const UserDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { tenantMode, tenantEnabled } = useClientConfig();
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadUserDetails = useCallback(async () => {
        if (!id) return;
        try {
            const data = await api.get<UserDetails>(`/api/users/${id}`);
            setUserDetails(data);
            setError(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load user');
            setUserDetails(null);
        }
    }, [id]);

    useEffect(() => {
        if (!id) {
            navigate('/users', { replace: true });
            return;
        }
        const load = async () => {
            setLoading(true);
            try {
                await loadUserDetails();
                const [rolesRes, tenantsRes] = await Promise.all([
                    api.get<{ data: Role[] }>('/api/roles'),
                    api.get<{ data: Tenant[] }>('/api/tenants'),
                ]);
                setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
                setTenants(Array.isArray(tenantsRes.data) ? tenantsRes.data : []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, loadUserDetails, navigate]);

    const handleUpdate = async (
        userId: string,
        updates: Partial<import('../types').User> & {
            tenantIds?: string[];
            tenantRoles?: { tenantId: string; roleIds: string[] }[];
            roleIds?: string[];
        }
    ) => {
        await api.patch(`/api/users/${userId}`, updates);
        await loadUserDetails();
    };

    if (!id) return null;

    if (loading && !userDetails) {
        return (
            <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 8 }}>
                <CircularProgress size={40} />
                <Typography variant="body2" color="text.secondary">Loading user...</Typography>
            </Stack>
        );
    }

    if (error || !userDetails) {
        return (
            <PageHeader
                title="User"
                description={error || 'User not found'}
                onRefresh={loadUserDetails}
                action={
                    <Button
                        component={Link}
                        to="/users"
                        variant="outlined"
                        color="inherit"
                        startIcon={<Icon component={ArrowLeft} />}
                    >
                        Back to users
                    </Button>
                }
            />
        );
    }

    return (
        <Stack spacing={2}>
            <PageHeader
                title={userDetails.user.email}
                description="User details & management"
                onRefresh={loadUserDetails}
                action={
                    <Button
                        component={Link}
                        to="/users"
                        variant="outlined"
                        color="inherit"
                        startIcon={<Icon component={ArrowLeft} />}
                    >
                        Back to users
                    </Button>
                }
            />
            <UserDetailView
                userDetails={userDetails}
                roles={roles}
                tenants={tenants}
                tenantMode={tenantMode}
                tenantEnabled={tenantEnabled}
                onUpdate={handleUpdate}
                onRefresh={loadUserDetails}
            />
        </Stack>
    );
};
