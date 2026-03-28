import React, { useState, useEffect } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { Dialog } from '../dialog';
import { UserDetailView } from './user-detail-view';
import type { User, Role, UserDetails, Tenant } from '../../types';
import { api } from '../../services/api';

interface UserDetailModalProps {
    user: User;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<User>) => Promise<void>;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user: initialUser, onClose, onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<Role[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

    const loadUserDetails = async () => {
        const data = await api.get<UserDetails>(`/api/users/${initialUser.id}`);
        setUserDetails(data);
        return data;
    };

    useEffect(() => {
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
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [initialUser.id]);

    const handleUpdate = async (id: string, updates: Partial<User>) => {
        await onUpdate(id, updates);
        await loadUserDetails();
    };

    if (loading || !userDetails) {
        return (
            <Dialog open onClose={onClose} title="Loading..." maxWidth="sm">
                <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 8 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary">Loading user details...</Typography>
                </Stack>
            </Dialog>
        );
    }

    const headerIcon = (
        <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--mui-palette-primary-light)', color: 'var(--mui-palette-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.125rem' }}>
            {userDetails.user.email.charAt(0).toUpperCase()}
        </span>
    );

    return (
        <Dialog
            open
            onClose={onClose}
            title={userDetails.user.email}
            subTitle="User Details & Management"
            icon={headerIcon}
            maxWidth="xl"
            fullScreen
        >
            <UserDetailView
                userDetails={userDetails}
                roles={roles}
                tenants={tenants}
                onUpdate={handleUpdate}
                onRefresh={loadUserDetails}
                onClose={onClose}
            />
        </Dialog>
    );
};
