import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, Building2, Shield, CheckCircle, XCircle, Calendar, Edit2, Save, Lock, Key, Smartphone, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '../Button';
import { MultiSelect } from '../MultiSelect';
import { PasswordField } from '../form/PasswordField';
import { EmailField } from '../form/EmailField';
import { FormField } from '../form/FormField';
import type { User, Role, UserDetails, TotpDevice } from '../../types';
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

interface UserDetailModalProps {
    user: User;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<User>) => Promise<void>;
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ user: initialUser, onClose, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<Role[]>([]);
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [selectedRoles, setSelectedRoles] = useState<string[]>(initialUser.roles);
    const [metadataError, setMetadataError] = useState<string>('');
    const [passwordError, setPasswordError] = useState<string>('');
    const [sessionError, setSessionError] = useState<string>('');
    const [sessionActionId, setSessionActionId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        email: initialUser.email,
        phone: initialUser.phone || '',
        isActive: initialUser.isActive,
        isVerified: initialUser.isVerified,
        metadata: JSON.stringify(initialUser.metadata || {}, null, 2),
        password: '',
        emailLoginEnabled: true,
        phoneLoginEnabled: false,
        isMfaEnabled: false,
    });
    const confirm = useConfirm();

    const loadUserDetails = async () => {
        const detailsResponse = await api.get<UserDetails>(`/api/users/${initialUser.id}`);
        setUserDetails(detailsResponse);
        return detailsResponse;
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Load user details
                const detailsResponse = await loadUserDetails();
                if (detailsResponse) {
                    setFormData(prev => ({
                        ...prev,
                        emailLoginEnabled: detailsResponse.loginMethods.emailEnabled,
                        phoneLoginEnabled: detailsResponse.loginMethods.phoneEnabled,
                        isMfaEnabled: detailsResponse.mfa?.isEnabled ?? detailsResponse.user.isMfaEnabled,
                    }));
                    setSelectedRoles(detailsResponse.user.roles);
                }

                // Load roles
                const rolesResponse = await api.get<{ data: Role[] }>('/api/roles');
                const rolesData = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
                setRoles(rolesData);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [initialUser.id]);

    const handleSave = async () => {
        if (metadataError || passwordError) {
            return;
        }

        setSaving(true);
        try {
            let parsedMetadata;
            try {
                parsedMetadata = JSON.parse(formData.metadata);
            } catch (parseError) {
                setMetadataError('Invalid JSON format');
                setSaving(false);
                return;
            }

            const updates: any = {
                email: formData.email,
                phone: formData.phone,
                isActive: formData.isActive,
                isVerified: formData.isVerified,
                roles: selectedRoles,
                metadata: parsedMetadata,
                emailLoginEnabled: formData.emailLoginEnabled,
                phoneLoginEnabled: formData.phoneLoginEnabled,
                isMfaEnabled: formData.isMfaEnabled,
            };

            if (formData.password) {
                updates.password = formData.password;
            }

            await onUpdate(initialUser.id, updates);
            setIsEditing(false);
            setFormData(prev => ({ ...prev, password: '' }));

            // Reload user details
            const detailsResponse = await loadUserDetails();
            if (detailsResponse) {
                setSelectedRoles(detailsResponse.user.roles);
                setFormData(prev => ({
                    ...prev,
                    email: detailsResponse.user.email,
                    phone: detailsResponse.user.phone || '',
                    isActive: detailsResponse.user.isActive,
                    isVerified: detailsResponse.user.isVerified,
                    metadata: JSON.stringify(detailsResponse.user.metadata || {}, null, 2),
                    password: '',
                    emailLoginEnabled: detailsResponse.loginMethods.emailEnabled,
                    phoneLoginEnabled: detailsResponse.loginMethods.phoneEnabled,
                    isMfaEnabled: detailsResponse.mfa?.isEnabled ?? detailsResponse.user.isMfaEnabled,
                }));
            }
        } catch (error: any) {
            if (error.message?.includes('Password')) {
                setPasswordError(error.message);
            }
            console.error('Failed to update user:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTotpDevice = async (deviceId: string, deviceName: string) => {
        const confirmed = await confirm(`Are you sure you want to delete the TOTP device "${deviceName}"? This action cannot be undone.`);
        if (!confirmed) {
            return;
        }

        try {
            await api.delete(`/api/users/${initialUser.id}/totp-devices/${deviceId}`);
            // Reload user details
            await loadUserDetails();
        } catch (error) {
            console.error('Failed to delete TOTP device:', error);
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        const confirmed = await confirm('Revoke this session? The user will be signed out on that device.');
        if (!confirmed) {
            return;
        }

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
        if (!userDetails?.sessions?.length) {
            return;
        }

        const confirmed = await confirm('Revoke all sessions for this user? They will be signed out everywhere.');
        if (!confirmed) {
            return;
        }

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

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl p-4">
                    <div className="text-center">Loading user details...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">
                            {currentUser.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{currentUser.email}</h2>
                            <p className="text-primary-100 text-xs">User Details & Management</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Basic Information */}
                            <div className="space-y-3">
                                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-primary-600" />
                                    Basic Information
                                </h3>

                                <div className="space-y-2">
                                    {isEditing ? (
                                        <>
                                            <EmailField
                                                id="edit-email"
                                                label="Email Address"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                disabled={saving}
                                                placeholder="user@example.com"
                                                required
                                            />
                                            <FormField
                                                id="edit-phone"
                                                label="Phone Number"
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                disabled={saving}
                                                placeholder="+1234567890"
                                                startIcon={<Phone className="w-5 h-5 text-gray-400" />}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-2.5 bg-gray-50 rounded-lg">
                                                <label className="text-xs font-medium text-gray-600">Email Address</label>
                                                <p className="text-sm text-gray-900 font-medium mt-0.5">{currentUser.email}</p>
                                            </div>

                                            <div className="p-2.5 bg-gray-50 rounded-lg">
                                                <label className="text-xs font-medium text-gray-600">Phone Number</label>
                                                <p className="text-sm text-gray-900 font-medium mt-0.5">{currentUser.phone || '—'}</p>
                                            </div>
                                        </>
                                    )}
                                    <div className="p-2.5 bg-gray-50 rounded-lg">
                                        <label className="text-xs font-medium text-gray-600">User ID</label>
                                        <p className="text-xs text-gray-600 font-mono mt-0.5">{currentUser.id}</p>
                                    </div>

                                    <div className="p-2.5 bg-gray-50 rounded-lg">
                                        <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                                            <Building2 className="w-3.5 h-3.5" />
                                            Tenant ID
                                        </label>
                                        <p className="text-sm text-gray-900 font-medium mt-0.5">{currentUser.tenantId || '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Status & Verification */}
                            <div className="space-y-3">
                                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-primary-600" />
                                    Status & Security
                                </h3>

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <div className="p-2.5 bg-gray-50 rounded-lg">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isActive}
                                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">Account Active</span>
                                            </label>
                                        </div>

                                        <div className="p-2.5 bg-gray-50 rounded-lg">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isVerified}
                                                    onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                                                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">Email Verified</span>
                                            </label>
                                        </div>

                                        <div className="p-2.5 bg-gray-50 rounded-lg">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isMfaEnabled}
                                                    onChange={(e) => setFormData({ ...formData, isMfaEnabled: e.target.checked })}
                                                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">MFA Enabled</span>
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="p-2.5 bg-gray-50 rounded-lg flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-600">Account Status</span>
                                            {currentUser.isActive ? (
                                                <span className="badge-success flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="badge-danger flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" />
                                                    Inactive
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-2.5 bg-gray-50 rounded-lg flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-600">Email Verification</span>
                                            {currentUser.isVerified ? (
                                                <span className="badge-success flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="badge-warning flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" />
                                                    Not Verified
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-2.5 bg-gray-50 rounded-lg flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-600">MFA Status</span>
                                            {currentUser.isMfaEnabled ? (
                                                <span className="badge-success flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Enabled
                                                </span>
                                            ) : (
                                                <span className="badge-secondary flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" />
                                                    Disabled
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="p-2.5 bg-gray-50 rounded-lg">
                                    <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Created At
                                    </label>
                                    <p className="text-sm text-gray-900 mt-0.5">{new Date(currentUser.createdAt).toLocaleString()}</p>
                                </div>

                                <div className="p-2.5 bg-gray-50 rounded-lg">
                                    <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Last Updated
                                    </label>
                                    <p className="text-sm text-gray-900 mt-0.5">{new Date(currentUser.updatedAt).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* MFA Methods Overview */}
                        <div className="mt-4">
                            <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-primary-600" />
                                MFA Methods
                            </h3>
                            {availableMfaMethods.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {availableMfaMethods.map((method) => {
                                        const isEnabled = enabledMfaMethods.includes(method);
                                        return (
                                            <span
                                                key={method}
                                                className={`${isEnabled ? 'badge-success' : 'badge-secondary'} text-xs flex items-center gap-1`}
                                            >
                                                {formatMfaMethod(method)}
                                                {isEnabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">MFA is disabled in the global configuration.</p>
                            )}
                            <div className="mt-2 flex flex-col gap-1">
                                <span className="text-xs text-gray-600">
                                    Recovery code: {mfaDetails?.hasRecoveryCode ? 'Generated' : 'Not generated'}
                                </span>
                                {mfaDetails && !mfaDetails.allowUserToggle && (
                                    <span className="text-xs text-amber-600">
                                        Users cannot toggle MFA themselves for this application.
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Password Management */}
                        {isEditing && (
                            <div className="mt-4">
                                <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-primary-600" />
                                    Password Management
                                </h3>
                                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-2">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-800">
                                            Leave password empty to keep current password. Password must contain uppercase, lowercase, number, and special character.
                                        </p>
                                    </div>
                                </div>
                                <PasswordField
                                    id="change-password"
                                    label="New Password (optional)"
                                    value={formData.password}
                                    onChange={(e) => {
                                        setFormData({ ...formData, password: e.target.value });
                                        setPasswordError('');
                                    }}
                                    disabled={saving}
                                    error={passwordError}
                                    placeholder="Leave empty to keep current password"
                                    required={false}
                                    showStrengthIndicator={!!formData.password}
                                />
                            </div>
                        )}

                        {/* Login Methods */}
                        <div className="mt-4">
                            <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Key className="w-4 h-4 text-primary-600" />
                                Login Methods
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {isEditing ? (
                                    <>
                                        <div className="p-3 border border-gray-200 rounded-lg">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-900">Email/Password</span>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.emailLoginEnabled}
                                                        onChange={(e) => setFormData({ ...formData, emailLoginEnabled: e.target.checked })}
                                                        disabled={!currentUser.email}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                                </label>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {currentUser.email ? 'User can login with email and password' : 'Email not set'}
                                            </p>
                                        </div>

                                        <div className="p-3 border border-gray-200 rounded-lg">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Smartphone className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-900">Phone/OTP</span>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.phoneLoginEnabled}
                                                        onChange={(e) => setFormData({ ...formData, phoneLoginEnabled: e.target.checked })}
                                                        disabled={!currentUser.phone}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                                </label>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {currentUser.phone ? 'User can login with phone and OTP' : 'Phone not set'}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-3 border border-gray-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-900">Email/Password</span>
                                                </div>
                                                {loginMethods.emailEnabled ? (
                                                    <span className="badge-success">Enabled</span>
                                                ) : (
                                                    <span className="badge-secondary">Disabled</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {loginMethods.hasPassword ? 'Password set' : 'No password set'}
                                            </p>
                                        </div>

                                        <div className="p-3 border border-gray-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Smartphone className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm font-medium text-gray-900">Phone/OTP</span>
                                                </div>
                                                {loginMethods.phoneEnabled ? (
                                                    <span className="badge-success">Enabled</span>
                                                ) : currentUser.phone ? (
                                                    <span className="badge-secondary">Available</span>
                                                ) : (
                                                    <span className="badge-secondary">Not Set</span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* TOTP Devices */}
                        <div className="mt-4">
                            <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-primary-600" />
                                TOTP Devices ({totpDevices.length})
                            </h3>
                            {totpDevices.length > 0 ? (
                                <div className="space-y-2">
                                    {totpDevices.map((device) => (
                                        <div key={device.id} className="p-2.5 border border-gray-200 rounded-lg flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900">{device.deviceName}</span>
                                                    {device.verified ? (
                                                        <span className="badge-success text-xs">Verified</span>
                                                    ) : (
                                                        <span className="badge-warning text-xs">Pending</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {device.lastUsedAt
                                                        ? `Last used: ${new Date(device.lastUsedAt).toLocaleString()}`
                                                        : `Added: ${new Date(device.createdAt).toLocaleString()}`}
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleDeleteTotpDevice(device.id, device.deviceName)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-2.5 border border-gray-200 rounded-lg text-center text-xs text-gray-500">
                                    No TOTP devices configured
                                </div>
                            )}
                        </div>

                        {/* Sessions */}
                        <div className="mt-4">
                            <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary-600" />
                                Active Sessions ({sessions.length})
                            </h3>
                            {sessionError && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg mb-2">
                                    {sessionError}
                                </div>
                            )}
                            {sessions.length > 0 ? (
                                <div className="space-y-2">
                                    {sessions.map((session) => (
                                        <div key={session.id} className="p-2.5 border border-gray-200 rounded-lg flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{session.deviceName || 'Unknown device'}</p>
                                                {session.userAgent && (
                                                    <p className="text-xs text-gray-500 truncate max-w-xs">{session.userAgent}</p>
                                                )}
                                                <p className="text-xs text-gray-500">
                                                    Last active:{' '}
                                                    {session.lastActive
                                                        ? new Date(session.lastActive).toLocaleString()
                                                        : 'Unknown'}
                                                </p>
                                                {session.ipAddress && (
                                                    <p className="text-xs text-gray-500">IP: {session.ipAddress}</p>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleRevokeSession(session.id)}
                                                disabled={sessionActionId === session.id}
                                            >
                                                {sessionActionId === session.id ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                                                        Revoking...
                                                    </span>
                                                ) : (
                                                    <>
                                                        <Trash2 className="w-4 h-4" />
                                                        Revoke
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="secondary"
                                        onClick={handleRevokeAllSessions}
                                        disabled={sessionActionId === 'all'}
                                    >
                                        {sessionActionId === 'all' ? (
                                            <span className="flex items-center gap-1">
                                                <span className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full" />
                                                Revoking all...
                                            </span>
                                        ) : (
                                            'Revoke All Sessions'
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-2.5 border border-gray-200 rounded-lg text-center text-xs text-gray-500">
                                    No active sessions
                                </div>
                            )}
                        </div>

                        {/* Roles */}
                        <div className="mt-4">
                            <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary-600" />
                                Assigned Roles
                            </h3>
                            {isEditing ? (
                                <MultiSelect
                                    value={selectedRoles}
                                    onChange={setSelectedRoles}
                                    options={roles.map((r) => ({
                                        value: r.name,
                                        label: r.tenantId ? `${r.name} (${r.guard})` : `${r.name} (${r.guard}) - Global`
                                    }))}
                                    placeholder="Select roles..."
                                />
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {currentUser.roles.length > 0 ? (
                                        currentUser.roles.map((role) => (
                                            <span key={role} className="badge-info">
                                                {role}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-gray-500 italic">No roles assigned</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Metadata */}
                        <div className="mt-4">
                            <h3 className="text-base font-semibold text-gray-900 mb-2">Custom Metadata</h3>
                            {isEditing ? (
                                <div>
                                    <textarea
                                        value={formData.metadata}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            setFormData({ ...formData, metadata: newValue });

                                            // Validate JSON
                                            try {
                                                JSON.parse(newValue);
                                                setMetadataError('');
                                            } catch (err) {
                                                setMetadataError('Invalid JSON format');
                                            }
                                        }}
                                        className={`input-field font-mono text-xs ${metadataError ? 'border-red-500' : ''}`}
                                        rows={6}
                                        placeholder='{"key": "value"}'
                                    />
                                    {metadataError && (
                                        <p className="text-xs text-red-600 mt-0.5">{metadataError}</p>
                                    )}
                                </div>
                            ) : (
                                <pre className="bg-gray-50 p-2.5 rounded-lg overflow-x-auto text-xs">
                                    {JSON.stringify(currentUser.metadata || {}, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-between flex-shrink-0">
                    {isEditing ? (
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setIsEditing(false);
                                    setSelectedRoles(currentUser.roles);
                                    setFormData({
                                        email: currentUser.email,
                                        phone: currentUser.phone || '',
                                        isActive: currentUser.isActive,
                                        isVerified: currentUser.isVerified,
                                        metadata: JSON.stringify(currentUser.metadata || {}, null, 2),
                                        password: '',
                                        emailLoginEnabled: loginMethods.emailEnabled,
                                        phoneLoginEnabled: loginMethods.phoneEnabled,
                                        isMfaEnabled: ((mfaDetails as any)?.isEnabled ?? false) || (currentUser.isMfaEnabled ?? false),
                                    });
                                    setPasswordError('');
                                    setMetadataError('');
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="secondary" onClick={onClose}>
                                Close
                            </Button>
                            <Button onClick={() => setIsEditing(true)}>
                                <Edit2 className="w-4 h-4" />
                                Edit User
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
