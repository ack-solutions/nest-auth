import React, { useState, useEffect } from 'react';
import { Mail, Phone, Building2, Shield, CheckCircle, XCircle, Calendar, Edit2, Save, Lock, Key, Smartphone, Trash2, AlertCircle, User as UserIcon } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { MultiSelect } from '../MultiSelect';
import { PasswordField } from '../form/PasswordField';
import { EmailField } from '../form/EmailField';
import { FormField } from '../form/FormField';
import type { User, Role, UserDetails, TotpDevice, RoleAssignment } from '../../types';
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

// Section component for better organization
const Section: React.FC<{
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ title, icon, children, className = '' }) => (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 rounded-t-xl">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                {icon}
                {title}
            </h3>
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

// Toggle switch component
const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}> = ({ checked, onChange, disabled = false, label, description, icon }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-3">
            {icon && <span className="text-gray-500">{icon}</span>}
            <div>
                <span className="text-sm font-medium text-gray-900">{label}</span>
                {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
            </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="sr-only peer"
            />
            <div className={`w-11 h-6 rounded-full peer transition-colors ${disabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-300 peer-checked:bg-primary-600'} peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:after:translate-x-full`}></div>
        </label>
    </div>
);

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
    const [selectedRoles, setSelectedRoles] = useState<string[]>(
        // Initialize with composite keys from user's role names (will be updated when roles load)
        initialUser.roles.map(name => name)
    );
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

    /**
     * Convert role names to composite keys (name:guard) using loaded roles data
     */
    const roleNamesToKeys = (roleNames: string[], availableRoles: Role[]): string[] => {
        return roleNames.map(name => {
            const role = availableRoles.find(r => r.name === name);
            return role ? `${role.name}:${role.guard}` : name;
        }).filter((key): key is string => key !== undefined);
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const detailsResponse = await loadUserDetails();
                if (detailsResponse) {
                    setFormData(prev => ({
                        ...prev,
                        emailLoginEnabled: detailsResponse.loginMethods.emailEnabled,
                        phoneLoginEnabled: detailsResponse.loginMethods.phoneEnabled,
                        isMfaEnabled: detailsResponse.mfa?.isEnabled ?? detailsResponse.user.isMfaEnabled,
                    }));
                }

                // Load roles first so we can convert role names to composite keys
                const rolesResponse = await api.get<{ data: Role[] }>('/api/roles');
                const rolesData = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
                setRoles(rolesData);

                // Now convert user's role names to composite keys using loaded roles
                if (detailsResponse) {
                    const roleKeys = roleNamesToKeys(detailsResponse.user.roles, rolesData);
                    setSelectedRoles(roleKeys);
                }
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

            // Convert selected role keys (name:guard) to RoleAssignment objects
            const roleAssignments: RoleAssignment[] = selectedRoles.map(key => {
                const [name, guard] = key.split(':');
                return { name, guard };
            });

            const updates: any = {
                email: formData.email,
                phone: formData.phone,
                isActive: formData.isActive,
                isVerified: formData.isVerified,
                roles: roleAssignments,
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

            const detailsResponse = await loadUserDetails();
            if (detailsResponse) {
                const roleKeys = roleNamesToKeys(detailsResponse.user.roles, roles);
                setSelectedRoles(roleKeys);
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

    const handleCancelEdit = () => {
        setIsEditing(false);
        setSelectedRoles(roleNamesToKeys(currentUser.roles, roles));
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

    // Footer actions
    const footerContent = (
        <div className="flex items-center justify-between w-full">
            {isEditing ? (
                <>
                    <Button variant="secondary" onClick={handleCancelEdit}>
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
    );

    // Header with user avatar
    const headerIcon = (
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
            {currentUser.email.charAt(0).toUpperCase()}
        </div>
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={currentUser.email}
            description="User Details & Management"
            icon={headerIcon}
            maxWidth="5xl"
            footer={footerContent}
            animate
        >
            <div className="py-4 space-y-6">
                {/* User Overview Card */}
                <div className="bg-gradient-to-br from-primary-50 via-white to-primary-50 rounded-xl border border-primary-100 p-5">
                    <div className="flex items-start gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            {currentUser.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-gray-900 truncate">{currentUser.email}</h2>
                            <p className="text-sm text-gray-500 font-mono truncate">{currentUser.id}</p>
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <StatusBadge 
                                    status={currentUser.isActive} 
                                    activeLabel="Active" 
                                    inactiveLabel="Inactive" 
                                />
                                <StatusBadge 
                                    status={currentUser.isVerified} 
                                    activeLabel="Verified" 
                                    inactiveLabel="Unverified" 
                                    variant="success-warning"
                                />
                                <StatusBadge 
                                    status={currentUser.isMfaEnabled} 
                                    activeLabel="MFA Enabled" 
                                    inactiveLabel="MFA Disabled" 
                                    variant="success-secondary"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Basic Information */}
                    <Section title="Basic Information" icon={<UserIcon className="w-4 h-4 text-primary-600" />}>
                        {isEditing ? (
                            <div className="space-y-4">
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
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <InfoRow 
                                    label="Email Address" 
                                    value={currentUser.email} 
                                    icon={<Mail className="w-3.5 h-3.5" />} 
                                />
                                <InfoRow 
                                    label="Phone Number" 
                                    value={currentUser.phone || '—'} 
                                    icon={<Phone className="w-3.5 h-3.5" />} 
                                />
                                <InfoRow 
                                    label="Tenant ID" 
                                    value={currentUser.tenantId || '—'} 
                                    icon={<Building2 className="w-3.5 h-3.5" />} 
                                />
                            </div>
                        )}
                    </Section>

                    {/* Status & Security */}
                    <Section title="Status & Security" icon={<Shield className="w-4 h-4 text-primary-600" />}>
                        {isEditing ? (
                            <div className="space-y-3">
                                <ToggleSwitch
                                    checked={formData.isActive}
                                    onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                    label="Account Active"
                                    description="Allow user to sign in"
                                    icon={<CheckCircle className="w-4 h-4" />}
                                />
                                <ToggleSwitch
                                    checked={formData.isVerified}
                                    onChange={(checked) => setFormData({ ...formData, isVerified: checked })}
                                    label="Email Verified"
                                    description="Mark email as verified"
                                    icon={<Mail className="w-4 h-4" />}
                                />
                                <ToggleSwitch
                                    checked={formData.isMfaEnabled}
                                    onChange={(checked) => setFormData({ ...formData, isMfaEnabled: checked })}
                                    label="MFA Enabled"
                                    description="Require MFA for login"
                                    icon={<Shield className="w-4 h-4" />}
                                />
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <InfoRow 
                                    label="Account Status" 
                                    value={<StatusBadge status={currentUser.isActive} activeLabel="Active" inactiveLabel="Inactive" />} 
                                />
                                <InfoRow 
                                    label="Email Verification" 
                                    value={<StatusBadge status={currentUser.isVerified} activeLabel="Verified" inactiveLabel="Unverified" variant="success-warning" />} 
                                />
                                <InfoRow 
                                    label="MFA Status" 
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
                        )}
                    </Section>
                </div>

                {/* Password Management (Edit mode only) */}
                {isEditing && (
                    <Section title="Password Management" icon={<Lock className="w-4 h-4 text-primary-600" />}>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
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
                    </Section>
                )}

                {/* Login Methods */}
                <Section title="Login Methods" icon={<Key className="w-4 h-4 text-primary-600" />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isEditing ? (
                            <>
                                <ToggleSwitch
                                    checked={formData.emailLoginEnabled}
                                    onChange={(checked) => setFormData({ ...formData, emailLoginEnabled: checked })}
                                    disabled={!currentUser.email}
                                    label="Email/Password"
                                    description={currentUser.email ? 'User can login with email and password' : 'Email not set'}
                                    icon={<Mail className="w-4 h-4" />}
                                />
                                <ToggleSwitch
                                    checked={formData.phoneLoginEnabled}
                                    onChange={(checked) => setFormData({ ...formData, phoneLoginEnabled: checked })}
                                    disabled={!currentUser.phone}
                                    label="Phone/OTP"
                                    description={currentUser.phone ? 'User can login with phone and OTP' : 'Phone not set'}
                                    icon={<Smartphone className="w-4 h-4" />}
                                />
                            </>
                        ) : (
                            <>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-gray-600" />
                                            <span className="text-sm font-medium text-gray-900">Email/Password</span>
                                        </div>
                                        <StatusBadge 
                                            status={loginMethods.emailEnabled} 
                                            activeLabel="Enabled" 
                                            inactiveLabel="Disabled" 
                                            variant="success-secondary"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {loginMethods.hasPassword ? 'Password set' : 'No password set'}
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="w-4 h-4 text-gray-600" />
                                            <span className="text-sm font-medium text-gray-900">Phone/OTP</span>
                                        </div>
                                        <StatusBadge 
                                            status={loginMethods.phoneEnabled} 
                                            activeLabel="Enabled" 
                                            inactiveLabel={currentUser.phone ? 'Available' : 'Not Set'} 
                                            variant="success-secondary"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {currentUser.phone ? `Phone: ${currentUser.phone}` : 'Phone number not configured'}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </Section>

                {/* MFA Methods */}
                <Section title="MFA Methods" icon={<Shield className="w-4 h-4 text-primary-600" />}>
                    {availableMfaMethods.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {availableMfaMethods.map((method) => {
                                    const isEnabled = enabledMfaMethods.includes(method);
                                    return (
                                        <span
                                            key={method}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
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
                            <div className="flex flex-col gap-1 text-xs text-gray-600">
                                <span className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${mfaDetails?.hasRecoveryCode ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                    Recovery code: {mfaDetails?.hasRecoveryCode ? 'Generated' : 'Not generated'}
                                </span>
                                {mfaDetails && !mfaDetails.allowUserToggle && (
                                    <span className="text-amber-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Users cannot toggle MFA themselves for this application.
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">MFA is disabled in the global configuration.</p>
                    )}
                </Section>

                {/* TOTP Devices */}
                <Section title={`TOTP Devices (${totpDevices.length})`} icon={<Smartphone className="w-4 h-4 text-primary-600" />}>
                    {totpDevices.length > 0 ? (
                        <div className="space-y-3">
                            {totpDevices.map((device) => (
                                <div key={device.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="w-4 h-4 text-gray-500" />
                                            <span className="text-sm font-medium text-gray-900">{device.deviceName}</span>
                                            <StatusBadge 
                                                status={device.verified} 
                                                activeLabel="Verified" 
                                                inactiveLabel="Pending" 
                                                variant="success-warning"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 ml-6">
                                            {device.lastUsedAt
                                                ? `Last used: ${new Date(device.lastUsedAt).toLocaleString()}`
                                                : `Added: ${new Date(device.createdAt).toLocaleString()}`}
                                        </p>
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
                        <div className="text-center py-8 text-gray-500">
                            <Smartphone className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No TOTP devices configured</p>
                        </div>
                    )}
                </Section>

                {/* Active Sessions */}
                <Section title={`Active Sessions (${sessions.length})`} icon={<Lock className="w-4 h-4 text-primary-600" />}>
                    {sessionError && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {sessionError}
                        </div>
                    )}
                    {sessions.length > 0 ? (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">{session.deviceName || 'Unknown device'}</p>
                                        {session.userAgent && (
                                            <p className="text-xs text-gray-500 truncate mt-0.5">{session.userAgent}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                            <span>
                                                Last active: {session.lastActive ? new Date(session.lastActive).toLocaleString() : 'Unknown'}
                                            </span>
                                            {session.ipAddress && (
                                                <span>IP: {session.ipAddress}</span>
                                            )}
                                        </div>
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
                                className="w-full"
                            >
                                {sessionActionId === 'all' ? (
                                    <span className="flex items-center gap-2 justify-center">
                                        <span className="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full" />
                                        Revoking all...
                                    </span>
                                ) : (
                                    'Revoke All Sessions'
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <Lock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No active sessions</p>
                        </div>
                    )}
                </Section>

                {/* Assigned Roles */}
                <Section title="Assigned Roles" icon={<Shield className="w-4 h-4 text-primary-600" />}>
                {isEditing ? (
                        <MultiSelect
                            value={selectedRoles}
                            onChange={setSelectedRoles}
                            options={roles.map((r) => ({
                                value: `${r.name}:${r.guard}`,
                                label: r.tenantId ? `${r.name} (${r.guard})` : `${r.name} (${r.guard}) - Global`
                            }))}
                            placeholder="Select roles..."
                        />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {currentUser.roles.length > 0 ? (
                                currentUser.roles.map((role) => (
                                    <span key={role} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                                        <Shield className="w-3 h-3 mr-1.5" />
                                        {role}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-gray-500 italic">No roles assigned</span>
                            )}
                        </div>
                    )}
                </Section>

                {/* Custom Metadata */}
                <Section title="Custom Metadata" icon={<Key className="w-4 h-4 text-primary-600" />}>
                    {isEditing ? (
                        <div>
                            <textarea
                                value={formData.metadata}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    setFormData({ ...formData, metadata: newValue });
                                    try {
                                        JSON.parse(newValue);
                                        setMetadataError('');
                                    } catch (err) {
                                        setMetadataError('Invalid JSON format');
                                    }
                                }}
                                className={`input-field font-mono text-xs ${metadataError ? 'border-red-500 focus:ring-red-500' : ''}`}
                                rows={6}
                                placeholder='{"key": "value"}'
                            />
                            {metadataError && (
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {metadataError}
                                </p>
                            )}
                        </div>
                    ) : (
                        <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs font-mono border border-gray-200 text-gray-700">
                            {JSON.stringify(currentUser.metadata || {}, null, 2)}
                        </pre>
                    )}
                </Section>
            </div>
        </Modal>
    );
};
