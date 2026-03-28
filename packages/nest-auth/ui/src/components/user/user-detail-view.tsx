import React, { useState } from 'react';
import { Mail, Phone, Building2, Shield, CheckCircle, XCircle, Calendar, Pencil, Lock, Key, Smartphone, Trash2, AlertCircle, User as UserIcon } from 'lucide-react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import { EditBasicInfoModal, EditStatusSecurityModal, EditRolesModal, EditMetadataModal, EditPasswordModal, EditTenantsModal } from './user-edit-dialogs';
import { UserTenantCard } from './user-tenant-card';
import { AddTenantDialog } from './add-tenant-dialog';
import type { User, Role, UserDetails, Tenant } from '../../types';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/use-confirm';
import { Icon } from '@mui/material';

const tooltipSlotProps = { popper: { sx: { '& .MuiTooltip-tooltip': { typography: 'caption' } } } };

const MFA_METHOD_LABELS: Record<string, string> = {
    totp: 'Authenticator App (TOTP)',
    sms: 'SMS',
    email: 'Email',
    backup_code: 'Backup Code',
};

const formatMfaMethod = (method?: string) => {
    if (!method) return 'Unknown';
    return MFA_METHOD_LABELS[method] || method.toUpperCase();
};

const Section: React.FC<{
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    action?: React.ReactNode;
}> = ({ title, icon, children, action }) => (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 1.5, py: 1.25, background: (t) => `linear-gradient(to right, ${(t.palette as any).grey?.[50] ?? t.palette.grey[50]}, ${(t.palette as any).grey?.[100] ?? t.palette.grey[100]})`, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
                {icon}
                <Typography variant="subtitle2" fontWeight={600}>{title}</Typography>
            </Stack>
            {action && <Box>{action}</Box>}
        </Stack>
        <Box sx={{ p: 1.5 }}>{children}</Box>
    </Paper>
);

const InfoRow: React.FC<{
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    mono?: boolean;
}> = ({ label, value, icon, mono = false }) => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'grey.100', '&:last-of-type': { borderBottom: 0 } }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
            {icon}
            <Typography variant="caption" color="text.secondary" fontWeight={500}>{label}</Typography>
        </Stack>
        <Typography variant="body2" fontWeight={500} sx={mono ? { fontFamily: 'monospace', fontSize: '0.75rem' } : {}}>
            {value}
        </Typography>
    </Stack>
);

const StatusBadge: React.FC<{
    status: boolean;
    activeLabel?: string;
    inactiveLabel?: string;
    variant?: 'success-danger' | 'success-warning' | 'success-secondary';
}> = ({ status, activeLabel = 'Active', inactiveLabel = 'Inactive', variant = 'success-danger' }) => {
    const sx = status
        ? { bgcolor: 'success.light', color: 'success.dark', borderColor: 'success.main' }
        : variant === 'success-danger'
            ? { bgcolor: 'error.light', color: 'error.dark', borderColor: 'error.main' }
            : variant === 'success-warning'
                ? { bgcolor: 'warning.light', color: 'warning.dark', borderColor: 'warning.main' }
                : { bgcolor: 'grey.100', color: 'grey.600', borderColor: 'grey.300' };

    return (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: '9999px', typography: 'caption', fontWeight: 600, border: '1px solid', ...sx }}>
            {status ? <Icon component={CheckCircle} sx={{ fontSize: 12 }} /> : <Icon component={XCircle} sx={{ fontSize: 12 }} />}
            {status ? activeLabel : inactiveLabel}
        </Box>
    );
};

export type TenantMode = 'isolated' | 'shared' | null;

export interface UserDetailViewProps {
    userDetails: UserDetails;
    roles: Role[];
    tenants: Tenant[];
    tenantMode?: TenantMode;
    onUpdate: (id: string, updates: Partial<User> & { tenantIds?: string[]; tenantRoles?: { tenantId: string; roleIds: string[] }[] }) => Promise<void>;
    onRefresh?: () => void | Promise<void>;
    onClose?: () => void;
}

export const UserDetailView: React.FC<UserDetailViewProps> = ({ userDetails, roles, tenants, tenantMode = null, onUpdate, onRefresh, onClose }) => {
    const [saving, setSaving] = useState(false);
    const [sessionError, setSessionError] = useState<string>('');
    const [sessionActionId, setSessionActionId] = useState<string | null>(null);
    const [showBasicInfoEdit, setShowBasicInfoEdit] = useState(false);
    const [showSecurityEdit, setShowSecurityEdit] = useState(false);
    const [showPasswordEdit, setShowPasswordEdit] = useState(false);
    const [showRolesEdit, setShowRolesEdit] = useState(false);
    const [showTenantsEdit, setShowTenantsEdit] = useState(false);
    const [showMetadataEdit, setShowMetadataEdit] = useState(false);
    const [showAddTenant, setShowAddTenant] = useState(false);
    const confirm = useConfirm();

    const currentUser = userDetails.user;
    const loginMethods = userDetails.loginMethods || {
        emailEnabled: !!currentUser.emailVerifiedAt,
        phoneEnabled: !!currentUser.phoneVerifiedAt,
        hasPassword: false,
    };
    const mfaDetails = userDetails.mfa;
    const totpDevices = mfaDetails?.totpDevices || [];
    const sessions = userDetails.sessions || [];
    const availableMfaMethods = mfaDetails?.availableMethods || [];
    const enabledMfaMethods = mfaDetails?.enabledMethods || [];

    const handlePartialUpdate = async (updates: Partial<User>) => {
        setSaving(true);
        try {
            await onUpdate(currentUser.id, updates);
            setShowBasicInfoEdit(false);
            setShowSecurityEdit(false);
            setShowPasswordEdit(false);
            setShowRolesEdit(false);
            setShowTenantsEdit(false);
            setShowMetadataEdit(false);
        } catch (error) {
            console.error('Failed to update user:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTotpDevice = async (deviceId: string, deviceName: string) => {
        const confirmed = await confirm(`Are you sure you want to delete the TOTP device "${deviceName}"? This action cannot be undone.`);
        if (!confirmed) return;
        try {
            await api.delete(`/api/users/${currentUser.id}/totp-devices/${deviceId}`);
            await onRefresh?.();
        } catch (error) {
            console.error('Failed to delete TOTP device:', error);
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        const confirmed = await confirm('Revoke this session? The user will be signed out on that device.');
        if (!confirmed) return;
        try {
            setSessionError('');
            setSessionActionId(sessionId);
            await api.delete(`/api/users/${currentUser.id}/sessions/${sessionId}`);
            await onRefresh?.();
        } catch (error: any) {
            setSessionError(error?.message || 'Failed to revoke session');
        } finally {
            setSessionActionId(null);
        }
    };

    const handleRevokeAllSessions = async () => {
        if (!userDetails.sessions?.length) return;
        const confirmed = await confirm('Revoke all sessions for this user? They will be signed out everywhere.');
        if (!confirmed) return;
        try {
            setSessionError('');
            setSessionActionId('all');
            await api.delete(`/api/users/${currentUser.id}/sessions`);
            await onRefresh?.();
        } catch (error: any) {
            setSessionError(error?.message || 'Failed to revoke sessions');
        } finally {
            setSessionActionId(null);
        }
    };

    const accessList = currentUser.userAccesses ?? [];
    const currentTenantIds = accessList.map((a) => a.tenantId).filter(Boolean);

    const handleRemoveTenant = async (tenantId: string) => {
        const confirmed = await confirm('Remove this user from the tenant? Their roles in this tenant will be removed.');
        if (!confirmed) return;
        setSaving(true);
        try {
            const newTenantIds = currentTenantIds.filter((id) => id !== tenantId);
            await onUpdate(currentUser.id, { tenantIds: newTenantIds });
            await onRefresh?.();
        } catch (error) {
            console.error('Failed to remove tenant:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddTenant = async (tenantId: string, roleIds: string[]) => {
        const newTenantIds = [...currentTenantIds, tenantId];
        const existingRoles = accessList.map((a) => ({
            tenantId: a.tenantId,
            roleIds: (a.roleIds ?? (a.roles ?? []).map((r: any) => (typeof r === 'string' ? r : r.id))) ?? [],
        }));
        const tenantRoles = [...existingRoles, { tenantId, roleIds }];
        await onUpdate(currentUser.id, { tenantIds: newTenantIds, tenantRoles });
        await onRefresh?.();
    };

    return (
        <>
            <Stack spacing={2}>
                {onClose && (
                    <Stack direction="row" justifyContent="flex-end">
                        <Button variant="outlined" color="inherit" onClick={onClose}>Close</Button>
                    </Stack>
                )}
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Stack spacing={2}>
                            <Section
                                title="Basic Information"
                                icon={<Icon component={UserIcon} sx={{ fontSize: 16, color: 'primary.main' }} />}
                                action={
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        <Tooltip title="Edit roles for this user" slotProps={tooltipSlotProps}>
                                            <Button size="small"
                                                variant="outlined" color="inherit" onClick={() => setShowRolesEdit(true)}
                                                startIcon={<Icon component={Shield} />}
                                                sx={{ minWidth: 0, py: 0.5 }}>
                                                Roles
                                            </Button>
                                        </Tooltip>
                                        <Tooltip title="Edit email, phone, and basic info" slotProps={tooltipSlotProps}>
                                            <Button
                                             size="small"
                                                variant="outlined"
                                                color="inherit"
                                                onClick={() => setShowBasicInfoEdit(true)}
                                                startIcon={<Icon component={Pencil} />}
                                                sx={{ minWidth: 0, py: 0.5 }}
                                            >
                                                Edit
                                            </Button>
                                        </Tooltip>
                                    </Stack>
                                }
                            >
                                <Stack spacing={0.25}>
                                    <InfoRow label="Email" value={currentUser.email} icon={<Icon component={Mail} sx={{ fontSize: 14 }} />} />
                                    <InfoRow label="Phone" value={currentUser.phone || '—'} icon={<Icon component={Phone} sx={{ fontSize: 14 }} />} />
                                </Stack>
                            </Section>

                            <Section
                                title="Tenants"
                                icon={<Icon component={Building2} sx={{ fontSize: 16, color: 'primary.main' }} />}
                                action={
                                    tenantMode === 'shared' ? (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="primary"
                                            onClick={() => setShowAddTenant(true)}
                                            sx={{ py: 0.5 }}
                                        >
                                            Add tenant
                                        </Button>
                                    ) : null
                                }
                            >
                                <Stack spacing={1}>
                                    {accessList.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                            No tenants assigned. {tenantMode === 'shared' ? 'Click "Add tenant" to assign.' : 'In isolated mode the user is assigned a tenant at creation.'}
                                        </Typography>
                                    ) : (
                                        accessList.map((access) => (
                                            <UserTenantCard
                                                key={access.tenantId}
                                                access={access}
                                                rolesForTenant={roles.filter((r) => !r.tenantId || r.tenantId === access.tenantId)}
                                                tenantMode={tenantMode}
                                                onEditRoles={() => setShowRolesEdit(true)}
                                                onRemove={tenantMode === 'shared' ? () => handleRemoveTenant(access.tenantId) : undefined}
                                                loading={saving}
                                            />
                                        ))
                                    )}
                                </Stack>
                            </Section>

                            <Section
                                title="Status & Security"
                                icon={<Icon component={Shield} sx={{ fontSize: 16, color: 'primary.main' }} />}
                                action={
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        <Tooltip title="Change user password" slotProps={tooltipSlotProps}>
                                            <Button size="small" variant="outlined" color="inherit" onClick={() => setShowPasswordEdit(true)} startIcon={<Icon component={Lock} />} sx={{ minWidth: 0, py: 0.5 }}>
                                                Password
                                            </Button>
                                        </Tooltip>
                                        <Tooltip title="Edit active status, verification, and security" slotProps={tooltipSlotProps}>
                                            <Button size="small" variant="outlined" color="inherit" onClick={() => setShowSecurityEdit(true)} startIcon={<Icon component={Pencil} />} sx={{ minWidth: 0, py: 0.5 }}>
                                                Edit
                                            </Button>
                                        </Tooltip>
                                    </Stack>
                                }
                            >
                                <Stack spacing={0.25}>
                                    <InfoRow label="Account" value={<StatusBadge status={currentUser.isActive} activeLabel="Active" inactiveLabel="Inactive" />} />
                                    <InfoRow label="Email" value={<StatusBadge status={currentUser.isVerified} activeLabel="Verified" inactiveLabel="Unverified" variant="success-warning" />} />
                                    <InfoRow label="MFA" value={<StatusBadge status={currentUser.isMfaEnabled} activeLabel="Enabled" inactiveLabel="Disabled" variant="success-secondary" />} />
                                    <InfoRow label="Created" value={new Date(currentUser.createdAt).toLocaleDateString()} icon={<Icon component={Calendar} sx={{ fontSize: 14 }} />} />
                                    <InfoRow label="Updated" value={new Date(currentUser.updatedAt).toLocaleDateString()} icon={<Icon component={Calendar} sx={{ fontSize: 14 }} />} />
                                </Stack>
                            </Section>
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Stack spacing={2}>
                            <Section title="Login Methods" icon={<Icon component={Key} sx={{ fontSize: 16, color: 'primary.main' }} />}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Icon component={Mail} sx={{ fontSize: 16, color: 'text.secondary' }} />
                                            <Box>
                                                <Typography variant="body2" fontWeight={500}>Email/Password</Typography>
                                                <Typography variant="caption" color="text.secondary">{loginMethods.hasPassword ? 'Password set' : 'No password'}</Typography>
                                            </Box>
                                        </Box>
                                        <StatusBadge status={loginMethods.emailEnabled} activeLabel="On" inactiveLabel="Off" variant="success-secondary" />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Icon component={Smartphone} sx={{ fontSize: 16, color: 'text.secondary' }} />
                                            <Box>
                                                <Typography variant="body2" fontWeight={500}>Phone/OTP</Typography>
                                                <Typography variant="caption" color="text.secondary">{currentUser.phone || 'Not configured'}</Typography>
                                            </Box>
                                        </Box>
                                        <StatusBadge status={loginMethods.phoneEnabled} activeLabel="On" inactiveLabel="Off" variant="success-secondary" />
                                    </Box>
                                </Box>
                            </Section>

                            <Section title="MFA Methods" icon={<Icon component={Shield} sx={{ fontSize: 16, color: 'primary.main' }} />}>
                                {availableMfaMethods.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {availableMfaMethods.map((method) => {
                                                const isEnabled = enabledMfaMethods.includes(method);
                                                return (
                                                    <Chip
                                                        key={method}
                                                        size="small"
                                                        label={formatMfaMethod(method)}
                                                        icon={isEnabled ? <Icon component={CheckCircle} sx={{ fontSize: 12 }} /> : <Icon component={XCircle} sx={{ fontSize: 12 }} />}
                                                        sx={isEnabled ? { bgcolor: 'success.50', color: 'success.dark', border: '1px solid', borderColor: 'success.200' } : { bgcolor: 'grey.100', color: 'text.secondary', border: '1px solid', borderColor: 'grey.300' }}
                                                    />
                                                );
                                            })}
                                        </Box>
                                        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: mfaDetails?.hasRecoveryCode ? 'success.main' : 'grey.400' }} />
                                                Recovery: {mfaDetails?.hasRecoveryCode ? 'Generated' : 'Not set'}
                                            </Box>
                                            {mfaDetails && !mfaDetails.allowUserToggle && (
                                                <Box sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                    <Icon component={AlertCircle} sx={{ fontSize: 12 }} />
                                                    User toggle disabled
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">MFA disabled in config</Typography>
                                )}
                            </Section>

                            <Section title={`TOTP Devices (${totpDevices.length})`} icon={<Icon component={Smartphone} sx={{ fontSize: 16, color: 'primary.main' }} />}>
                                {totpDevices.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {totpDevices.map((device) => (
                                            <Box key={device.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'grey.50', borderRadius: 1, '&:hover': { bgcolor: 'grey.100' } }}>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Icon component={Smartphone} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                        <Typography variant="body2" fontWeight={500} noWrap>{device.deviceName}</Typography>
                                                        <StatusBadge status={device.verified} activeLabel="✓" inactiveLabel="Pending" variant="success-warning" />
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {device.lastUsedAt ? `Used: ${new Date(device.lastUsedAt).toLocaleDateString()}` : `Added: ${new Date(device.createdAt).toLocaleDateString()}`}
                                                    </Typography>
                                                </Box>
                                                <Tooltip title={`Remove device "${device.deviceName}"`} slotProps={tooltipSlotProps}>
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteTotpDevice(device.id, device.deviceName)} aria-label={`Delete TOTP device ${device.deviceName}`}>
                                                        <Icon component={Trash2} sx={{ fontSize: 20 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <Box sx={{ textAlign: 'center', py: 3, color: 'text.disabled' }}>
                                        <Icon component={Smartphone} sx={{ fontSize: 32, margin: '0 auto 4px', display: 'block' }} />
                                        <Typography variant="caption">No devices</Typography>
                                    </Box>
                                )}
                            </Section>
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Stack spacing={2}>
                            <Section title="Custom Metadata" icon={<Icon component={Key} sx={{ fontSize: 16, color: 'primary.main' }} />} action={<Tooltip title="Edit custom metadata (JSON)" slotProps={tooltipSlotProps}><Button size="small" variant="outlined" color="inherit" onClick={() => setShowMetadataEdit(true)} startIcon={<Icon component={Pencil} />} sx={{ minWidth: 0, py: 0.5 }}>Edit metadata</Button></Tooltip>}>
                                <Box component="pre" sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1, overflowX: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', border: '1px solid', borderColor: 'divider', color: 'text.primary', maxHeight: 192, overflowY: 'auto' }}>
                                    {JSON.stringify(currentUser.metadata || {}, null, 2)}
                                </Box>
                            </Section>
                            <Section title={`Active Sessions (${sessions.length})`} icon={<Icon component={Lock} sx={{ fontSize: 16, color: 'primary.main' }} />}>
                                {sessionError && (
                                    <Box sx={{ bgcolor: 'error.light', border: '1px solid', borderColor: 'error.main', color: 'error.dark', typography: 'caption', px: 1.5, py: 1, borderRadius: 1, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Icon component={AlertCircle} sx={{ fontSize: 14 }} />
                                        {sessionError}
                                    </Box>
                                )}
                                {sessions.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {sessions.slice(0, 5).map((session) => (
                                            <Box key={session.id} sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', p: 1.5, bgcolor: 'grey.50', borderRadius: 1, gap: 1.5, '&:hover': { bgcolor: 'grey.100' } }}>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={500} noWrap>{session.deviceName || 'Unknown'}</Typography>
                                                    {session.ipAddress && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{session.ipAddress}</Typography>}
                                                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                                                        {session.lastActive ? new Date(session.lastActive).toLocaleString() : 'Unknown'}
                                                    </Typography>
                                                </Box>
                                                <Tooltip title="Revoke this session (user will be signed out on that device)" slotProps={tooltipSlotProps}>
                                                    <IconButton size="small" color="error" onClick={() => handleRevokeSession(session.id)} disabled={sessionActionId === session.id} aria-label="Revoke session">
                                                        {sessionActionId === session.id ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <Icon component={Trash2} sx={{ fontSize: 20 }} />}
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        ))}
                                        {sessions.length > 5 && (
                                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 0.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                                                +{sessions.length - 5} more sessions
                                            </Typography>
                                        )}
                                        <Tooltip title="Sign out this user on all devices" slotProps={tooltipSlotProps}>
                                            <span style={{ display: 'block', width: '100%' }}>
                                                <Button variant="outlined" color="inherit" onClick={handleRevokeAllSessions} disabled={sessionActionId === 'all'} fullWidth size="small" sx={{ mt: 1, typography: 'caption' }}>
                                                    {sessionActionId === 'all' ? (
                                                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <CircularProgress size={12} />
                                                            Revoking...
                                                        </Box>
                                                    ) : (
                                                        'Revoke all sessions'
                                                    )}
                                                </Button>
                                            </span>
                                        </Tooltip>
                                    </Box>
                                ) : (
                                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
                                        <Icon component={Lock} sx={{ fontSize: 40, margin: '0 auto 8px', display: 'block' }} />
                                        <Typography variant="caption">No active sessions</Typography>
                                    </Box>
                                )}
                            </Section>
                        </Stack>
                    </Grid>
                </Grid>
            </Stack>

            <EditBasicInfoModal open={showBasicInfoEdit} onClose={() => setShowBasicInfoEdit(false)} user={currentUser} onSave={handlePartialUpdate} loading={saving} />
            <EditStatusSecurityModal open={showSecurityEdit} onClose={() => setShowSecurityEdit(false)} user={currentUser} onSave={handlePartialUpdate} loading={saving} />
            <EditPasswordModal open={showPasswordEdit} onClose={() => setShowPasswordEdit(false)} user={currentUser} onSave={handlePartialUpdate} loading={saving} />
            <EditRolesModal open={showRolesEdit} onClose={() => setShowRolesEdit(false)} user={currentUser} onSave={handlePartialUpdate} loading={saving} roles={roles} tenants={tenants} />
            <EditTenantsModal open={showTenantsEdit} onClose={() => setShowTenantsEdit(false)} user={currentUser} onSave={handlePartialUpdate} loading={saving} tenants={tenants} />
            <EditMetadataModal open={showMetadataEdit} onClose={() => setShowMetadataEdit(false)} user={currentUser} onSave={handlePartialUpdate} loading={saving} />
            <AddTenantDialog
                open={showAddTenant}
                onClose={() => setShowAddTenant(false)}
                onAdd={handleAddTenant}
                tenants={tenants}
                existingTenantIds={currentTenantIds}
            />
        </>
    );
};
