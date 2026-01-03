import React, { useState, useEffect } from 'react';
import { Mail, Phone, Shield, User as UserIcon, Lock, AlertCircle, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { EmailField } from '../form/EmailField';
import { FormField } from '../form/FormField';
import { MultiSelect } from '../MultiSelect';
import { PasswordField } from '../form/PasswordField';
import type { User, Role, RoleAssignment } from '../../types';

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: Partial<User>) => Promise<void>;
    user: User;
    loading?: boolean;
}

export const EditBasicInfoModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, user, loading }) => {
    const [formData, setFormData] = useState({
        email: user.email,
        phone: user.phone || '',
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({
                email: user.email,
                phone: user.phone || '',
            });
        }
    }, [isOpen, user]);

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Edit Basic Information" 
            maxWidth="md"
            fixedHeight={false}
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 py-4">
                <EmailField
                    id="edit-email"
                    label="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                />
                <FormField
                    id="edit-phone"
                    label="Phone Number"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1234567890"
                    startIcon={<Phone className="w-5 h-5 text-gray-400" />}
                />
            </div>
        </Modal>
    );
};

export const EditStatusSecurityModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, user, loading }) => {
    const [formData, setFormData] = useState({
        isActive: user.isActive,
        isVerified: user.isVerified,
        isMfaEnabled: user.isMfaEnabled,
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({
                isActive: user.isActive,
                isVerified: user.isVerified,
                isMfaEnabled: user.isMfaEnabled,
            });
        }
    }, [isOpen, user]);

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Edit Status & Security" 
            maxWidth="md"
            fixedHeight={false}
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onSave(formData)} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-3 py-4">
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
        </Modal>
    );
};

export const EditPasswordModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, loading }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError('');
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!password) {
            setError('Password is required');
            return;
        }
        onSave({ password } as any);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Change Password" 
            maxWidth="md"
            fixedHeight={false}
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading || !password}>
                        {loading ? 'Saving...' : 'Update Password'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 py-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                            Password must contain uppercase, lowercase, number, and special character.
                        </p>
                    </div>
                </div>
                <PasswordField
                    id="new-password"
                    label="New Password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                    }}
                    error={error}
                    showStrengthIndicator
                />
            </div>
        </Modal>
    );
};

export const EditRolesModal: React.FC<EditModalProps & { roles: Role[] }> = ({ isOpen, onClose, onSave, user, loading, roles }) => {
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
             // Initialize with composite keys based on user roles and available roles
             const initialKeys = user.roles.map(roleName => {
                const role = roles.find(r => r.name === roleName);
                return role ? `${role.name}:${role.guard}` : roleName;
             });
            setSelectedRoles(initialKeys);
        }
    }, [isOpen, user, roles]);

    const handleSave = () => {
         const roleAssignments: RoleAssignment[] = selectedRoles.map(key => {
            const [name, guard] = key.split(':');
            return { name, guard };
        });
        onSave({ roles: roleAssignments as any }); 
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Manage Roles" 
            maxWidth="md"
            fixedHeight={false}
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            }
        >
            <div className="py-4 min-h-[300px]">
                <MultiSelect
                    value={selectedRoles}
                    onChange={setSelectedRoles}
                    options={roles.map((r) => ({
                        value: `${r.name}:${r.guard}`,
                        label: r.tenantId ? `${r.name} (${r.guard})` : `${r.name} (${r.guard}) - Global`
                    }))}
                    placeholder="Select roles..."
                />
            </div>
        </Modal>
    );
};

export const EditMetadataModal: React.FC<EditModalProps> = ({ isOpen, onClose, onSave, user, loading }) => {
    const [metadataStr, setMetadataStr] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMetadataStr(JSON.stringify(user.metadata || {}, null, 2));
            setError('');
        }
    }, [isOpen, user]);

    const handleSave = () => {
        try {
            const parsed = JSON.parse(metadataStr);
            onSave({ metadata: parsed });
        } catch (e) {
            setError('Invalid JSON format');
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Edit Metadata" 
            maxWidth="lg"
            fixedHeight={false}
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            }
        >
            <div className="py-4">
                <textarea
                    value={metadataStr}
                    onChange={(e) => {
                        setMetadataStr(e.target.value);
                        try {
                            JSON.parse(e.target.value);
                            setError('');
                        } catch (err) {
                            // optional: show error immediately or only on save
                        }
                    }}
                    className={`input-field font-mono text-sm h-64 ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder='{"key": "value"}'
                />
                {error && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                    </p>
                )}
            </div>
        </Modal>
    );
};

// Helper Toggle Component
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
