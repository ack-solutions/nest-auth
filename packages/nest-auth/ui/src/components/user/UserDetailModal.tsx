import React, { useState, useEffect } from 'react';
import { Mail, Phone, Building2, Shield, CheckCircle, XCircle, Calendar, Edit2, Lock, Key, Smartphone, Trash2, AlertCircle, User as UserIcon } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { EditBasicInfoModal, EditStatusSecurityModal, EditRolesModal, EditMetadataModal, EditPasswordModal } from './UserEditDialogs';
import type { User, Role, UserDetails, RoleAssignment } from '../../types';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';

const MFA_METHOD_LABELS: Record<string, string> = {
    totp: 'Authenticator App (TOTP)',
    sms: 'SMS',
    email: 'Email',
    backup_code: 'Backup Code',
};

const formatMfaMethod = (method?: string) => {
    if (!method) {
        return 'Unknown';
    }
    return MFA_METHOD_LABELS[method] || method.toUpperCase();
};

// Section component with optional action button
const Section: React.FC<{
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}> = ({ title, icon, children, className = '', action }) => (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 rounded-t-xl flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                {icon}
                {title}
            </h3>
            {action && <div>{action}</div>}
        </div>
        <div className="p-4">
            {children}
        </div>
    </div>
);

// Info row component for consistent display
const InfoRow: React.FC<{
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    mono?: boolean;
}> = ({ label, value, icon, mono = false }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
        <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
            {icon}
            {label}
        </span>
        <span className={`text-sm text-gray-900 ${mono ? 'font-mono text-xs' : 'font-medium'}`}>
            {value}
        </span>
    </div>
);

// Status badge component
const StatusBadge: React.FC<{
    status: boolean;
    activeLabel?: string;
    inactiveLabel?: string;
    variant?: 'success-danger' | 'success-warning' | 'success-secondary';
}> = ({ status, activeLabel = 'Active', inactiveLabel = 'Inactive', variant = 'success-danger' }) => {
    const getVariantClasses = () => {
        if (status) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        switch (variant) {
            case 'success-danger': return 'bg-red-50 text-red-700 border-red-200';
            case 'success-warning': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'success-secondary': return 'bg-gray-100 text-gray-600 border-gray-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getVariantClasses()}`}>
            {status ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {status ? activeLabel : inactiveLabel}
        </span>
    );
};

interface UserDetailModalProps {
    user: User;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<User>) => Promise<void>;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user: initialUser, onClose, onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<Role[]>([]);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [sessionError, setSessionError] = useState<string>('');
    const [sessionActionId, setSessionActionId] = useState<string | null>(null);
    const confirm = useConfirm();

    // Edit states
    const [showBasicInfoEdit, setShowBasicInfoEdit] = useState(false);
    const [showSecurityEdit, setShowSecurityEdit] = useState(false);
    const [showPasswordEdit, setShowPasswordEdit] = useState(false);
    const [showRolesEdit, setShowRolesEdit] = useState(false);
    const [showMetadataEdit, setShowMetadataEdit] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadUserDetails = async () => {
        const detailsResponse = await api.get<UserDetails>(`/api/users/${initialUser.id}`);
        setUserDetails(detailsResponse);
        return detailsResponse;
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                await loadUserDetails();
                const rolesResponse = await api.get<{ data: Role[] }>('/api/roles');
                setRoles(Array.isArray(rolesResponse.data) ? rolesResponse.data : []);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [initialUser.id]);

    const handlePartialUpdate = async (updates: Partial<User>) => {
        setSaving(true);
        try {
            await onUpdate(initialUser.id, updates);
            await loadUserDetails();
            setShowBasicInfoEdit(false);
            setShowSecurityEdit(false);
            setShowPasswordEdit(false);
            setShowRolesEdit(false);
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
            await api.delete(`/api/users/${initialUser.id}/totp-devices/${deviceId}`);
            await loadUserDetails();
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
            await api.delete(`/api/users/${initialUser.id}/sessions/${sessionId}`);
            await loadUserDetails();
        } catch (error: any) {
            setSessionError(error?.message || 'Failed to revoke session');
        } finally {
            setSessionActionId(null);
        }
    };

    const handleRevokeAllSessions = async () => {
        if (!userDetails?.sessions?.length) return;

        const confirmed = await confirm('Revoke all sessions for this user? They will be signed out everywhere.');
        if (!confirmed) return;

        try {
            setSessionError('');
            setSessionActionId('all');
            await api.delete(`/api/users/${initialUser.id}/sessions`);
            await loadUserDetails();
        } catch (error: any) {
            setSessionError(error?.message || 'Failed to revoke sessions');
        } finally {
            setSessionActionId(null);
        }
    };

    const currentUser = userDetails?.user || initialUser;
    const loginMethods = userDetails?.loginMethods || {
        emailEnabled: !!currentUser.emailVerifiedAt,
        phoneEnabled: !!currentUser.phoneVerifiedAt,
        hasPassword: false,
    };
    const mfaDetails = userDetails?.mfa;
    const totpDevices = mfaDetails?.totpDevices || [];
    const sessions = userDetails?.sessions || [];
    const availableMfaMethods = mfaDetails?.availableMethods || [];
    const enabledMfaMethods = mfaDetails?.enabledMethods || [];

    // Loading state
    if (loading) {
        return (
            <Modal
                isOpen={true}
                onClose={onClose}
                title="Loading..."
                maxWidth="5xl"
                animate
            >
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin h-10 w-10 border-4 border-primary-600 border-t-transparent rounded-full" />
                        <p className="text-sm text-gray-500">Loading user details...</p>
                    </div>
                </div>
            </Modal>
        );
    }

    // Header with user avatar
    const headerIcon = (
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
            {currentUser.email.charAt(0).toUpperCase()}
        </div>
    );

    return (
        <>
            <Modal
                isOpen={true}
                onClose={onClose}
                title={currentUser.email}
                description="User Details & Management"
                icon={headerIcon}
                maxWidth="3xl"
                animate
                fullscreen
                footer={
                    <div className="flex items-center justify-end w-full">
                         <Button variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">

                    {/* Three Column Grid Layout */}
                    <div className="grid grid-cols-3 gap-4 px-6">
                        {/* Left Column - Core Info */}
                        <div className="space-y-4">
                            {/* Basic Information */}
                            <Section 
                                title="Basic Information" 
                                icon={<UserIcon className="w-4 h-4 text-primary-600" />}
                                action={
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => setShowRolesEdit(true)} title="Edit Roles">
                                            <Shield className="w-4 h-4 text-gray-500" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setShowBasicInfoEdit(true)} title="Edit Info">
                                            <Edit2 className="w-4 h-4 text-gray-500" />
                                        </Button>
                                    </div>
                                }
                            >
                                <div className="space-y-1">
                                    <InfoRow 
                                        label="Email" 
                                        value={currentUser.email} 
                                        icon={<Mail className="w-3.5 h-3.5" />} 
                                    />
                                    <InfoRow 
                                        label="Phone" 
                                        value={currentUser.phone || '—'} 
                                        icon={<Phone className="w-3.5 h-3.5" />} 
                                    />
                                    <InfoRow 
                                        label="Tenant" 
                                        value={currentUser.tenantId || '—'} 
                                        icon={<Building2 className="w-3.5 h-3.5" />} 
                                        mono
                                    />
                                    <div className="flex items-start py-1.5">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-xs text-gray-500 block mb-1">Assigned Roles</span>
                                                {currentUser.roles.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {currentUser.roles.map((role) => (
                                                            <span key={role} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                                                                {role}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-500 italic">No roles assigned</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Section>

                            {/* Status & Security */}
                            <Section 
                                title="Status & Security" 
                                icon={<Shield className="w-4 h-4 text-primary-600" />}
                                action={
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => setShowPasswordEdit(true)} title="Change Password">
                                            <Lock className="w-4 h-4 text-gray-500" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setShowSecurityEdit(true)} title="Edit Status">
                                            <Edit2 className="w-4 h-4 text-gray-500" />
                                        </Button>
                                    </div>
                                }
                            >
                                <div className="space-y-1">
                                    <InfoRow 
                                        label="Account" 
                                        value={<StatusBadge status={currentUser.isActive} activeLabel="Active" inactiveLabel="Inactive" />} 
                                    />
                                    <InfoRow 
                                        label="Email" 
                                        value={<StatusBadge status={currentUser.isVerified} activeLabel="Verified" inactiveLabel="Unverified" variant="success-warning" />} 
                                    />
                                    <InfoRow 
                                        label="MFA" 
                                        value={<StatusBadge status={currentUser.isMfaEnabled} activeLabel="Enabled" inactiveLabel="Disabled" variant="success-secondary" />} 
                                    />
                                    <InfoRow 
                                        label="Created" 
                                        value={new Date(currentUser.createdAt).toLocaleDateString()} 
                                        icon={<Calendar className="w-3.5 h-3.5" />} 
                                    />
                                    <InfoRow 
                                        label="Updated" 
                                        value={new Date(currentUser.updatedAt).toLocaleDateString()} 
                                        icon={<Calendar className="w-3.5 h-3.5" />} 
                                    />
                                </div>
                            </Section>
                        </div>

                        {/* Middle Column - Auth & MFA */}
                        <div className="space-y-4">

                            {/* Login Methods */}
                            <Section title="Login Methods" icon={<Key className="w-4 h-4 text-primary-600" />}>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-gray-600" />
                                            <div>
                                                <span className="text-sm font-medium text-gray-900">Email/Password</span>
                                                <p className="text-xs text-gray-500">{loginMethods.hasPassword ? 'Password set' : 'No password'}</p>
                                            </div>
                                        </div>
                                        <StatusBadge 
                                            status={loginMethods.emailEnabled} 
                                            activeLabel="On" 
                                            inactiveLabel="Off" 
                                            variant="success-secondary"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="w-4 h-4 text-gray-600" />
                                            <div>
                                                <span className="text-sm font-medium text-gray-900">Phone/OTP</span>
                                                <p className="text-xs text-gray-500">{currentUser.phone || 'Not configured'}</p>
                                            </div>
                                        </div>
                                        <StatusBadge 
                                            status={loginMethods.phoneEnabled} 
                                            activeLabel="On" 
                                            inactiveLabel="Off" 
                                            variant="success-secondary"
                                        />
                                    </div>
                                </div>
                            </Section>

                            {/* MFA Methods */}
                            <Section title="MFA Methods" icon={<Shield className="w-4 h-4 text-primary-600" />}>
                                {availableMfaMethods.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {availableMfaMethods.map((method) => {
                                                const isEnabled = enabledMfaMethods.includes(method);
                                                return (
                                                    <span
                                                        key={method}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                                                            isEnabled 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                                        }`}
                                                    >
                                                        {formatMfaMethod(method)}
                                                        {isEnabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <div className="text-xs text-gray-600 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${mfaDetails?.hasRecoveryCode ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                                Recovery: {mfaDetails?.hasRecoveryCode ? 'Generated' : 'Not set'}
                                            </div>
                                            {mfaDetails && !mfaDetails.allowUserToggle && (
                                                <div className="text-amber-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    User toggle disabled
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">MFA disabled in config</p>
                                )}
                            </Section>

                            {/* TOTP Devices */}
                            <Section title={`TOTP Devices (${totpDevices.length})`} icon={<Smartphone className="w-4 h-4 text-primary-600" />}>
                                {totpDevices.length > 0 ? (
                                    <div className="space-y-2">
                                        {totpDevices.map((device) => (
                                            <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                                                        <span className="text-sm font-medium text-gray-900 truncate">{device.deviceName}</span>
                                                        <StatusBadge 
                                                            status={device.verified} 
                                                            activeLabel="✓" 
                                                            inactiveLabel="Pending" 
                                                            variant="success-warning"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-gray-500 ml-5 truncate">
                                                        {device.lastUsedAt
                                                            ? `Used: ${new Date(device.lastUsedAt).toLocaleDateString()}`
                                                            : `Added: ${new Date(device.createdAt).toLocaleDateString()}`}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => handleDeleteTotpDevice(device.id, device.deviceName)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400">
                                        <Smartphone className="w-8 h-8 mx-auto mb-1" />
                                        <p className="text-xs">No devices</p>
                                    </div>
                                )}
                            </Section>      
                        </div>

                        {/* Right Column - Sessions Only */}
                        <div className="space-y-4">
                            {/* Custom Metadata */}
                            <Section
                                title="Custom Metadata"
                                icon={<Key className="w-4 h-4 text-primary-600" />}
                                action={
                                    <Button size="sm" variant="ghost" onClick={() => setShowMetadataEdit(true)}>
                                        <Edit2 className="w-4 h-4 text-gray-500" />
                                    </Button>
                                }
                            >
                                <pre className="bg-gray-50 p-3 rounded-lg overflow-x-auto text-xs font-mono border border-gray-200 text-gray-700 max-h-48 overflow-y-auto">
                                    {JSON.stringify(currentUser.metadata || {}, null, 2)}
                                </pre>
                            </Section>
                            {/* Active Sessions */}
                            <Section title={`Active Sessions (${sessions.length})`} icon={<Lock className="w-4 h-4 text-primary-600" />}>
                                {sessionError && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-2">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {sessionError}
                                    </div>
                                )}
                                {sessions.length > 0 ? (
                                    <div className="space-y-2">
                                        {sessions.slice(0, 5).map((session) => (
                                            <div key={session.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{session.deviceName || 'Unknown'}</p>
                                                    {session.ipAddress && (
                                                        <p className="text-xs text-gray-500 truncate">{session.ipAddress}</p>
                                                    )}
                                                    <p className="text-xs text-gray-400">
                                                        {session.lastActive ? new Date(session.lastActive).toLocaleString() : 'Unknown'}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => handleRevokeSession(session.id)}
                                                    disabled={sessionActionId === session.id}
                                                >
                                                    {sessionActionId === session.id ? (
                                                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                        {sessions.length > 5 && (
                                            <p className="text-xs text-gray-500 text-center py-1 bg-gray-50 rounded">
                                                +{sessions.length - 5} more sessions
                                            </p>
                                        )}
                                        <Button
                                            variant="secondary"
                                            onClick={handleRevokeAllSessions}
                                            disabled={sessionActionId === 'all'}
                                            className="w-full text-xs mt-2"
                                            size="sm"
                                        >
                                            {sessionActionId === 'all' ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="animate-spin h-3 w-3 border-2 border-primary-600 border-t-transparent rounded-full" />
                                                    Revoking...
                                                </span>
                                            ) : (
                                                'Revoke All Sessions'
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <Lock className="w-10 h-10 mx-auto mb-2" />
                                        <p className="text-xs">No active sessions</p>
                                    </div>
                                )}
                            </Section>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Edit Modals */}
            <EditBasicInfoModal 
                isOpen={showBasicInfoEdit} 
                onClose={() => setShowBasicInfoEdit(false)} 
                user={currentUser} 
                onSave={handlePartialUpdate}
                loading={saving}
            />
            <EditStatusSecurityModal
                isOpen={showSecurityEdit}
                onClose={() => setShowSecurityEdit(false)}
                user={currentUser}
                onSave={handlePartialUpdate}
                loading={saving}
            />
            <EditPasswordModal
                isOpen={showPasswordEdit}
                onClose={() => setShowPasswordEdit(false)}
                user={currentUser}
                onSave={handlePartialUpdate}
                loading={saving}
            />
            <EditRolesModal
                isOpen={showRolesEdit}
                onClose={() => setShowRolesEdit(false)}
                user={currentUser}
                onSave={handlePartialUpdate}
                loading={saving}
                roles={roles}
            />
            <EditMetadataModal
                isOpen={showMetadataEdit}
                onClose={() => setShowMetadataEdit(false)}
                user={currentUser}
                onSave={handlePartialUpdate}
                loading={saving}
            />
        </>
    );
};
