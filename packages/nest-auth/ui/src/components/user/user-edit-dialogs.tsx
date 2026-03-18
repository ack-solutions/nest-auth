import React, { useState, useEffect } from 'react';
import { Mail, Phone, Shield, User as UserIcon, Lock, AlertCircle, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { Modal } from '../modal';
import { EmailField } from '../form/email-field';
import { FormField } from '../form/form-field';
import { MultiSelect } from '../multi-select';
import { PasswordField } from '../form/password-field';
import type { User, Role, Tenant } from '../../types';

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
            maxWidth="sm"
            footer={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={2} sx={{ py: 2 }}>
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
                    startIcon={<Icon component={Phone} sx={{ color: 'text.secondary' }} />}
                />
            </Stack>
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
            maxWidth="sm"
            footer={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={() => onSave(formData)} disabled={loading}>
{loading ? 'Saving...' : 'Save Changes'}
                      </Button>
                  </Stack>
              }
          >
            <Stack spacing={1.5} sx={{ py: 2 }}>
                <ToggleSwitch
                    checked={formData.isActive}
                    onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    label="Account Active"
                    description="Allow user to sign in"
                    icon={<Icon component={CheckCircle} />}
                />
                <ToggleSwitch
                    checked={formData.isVerified}
                    onChange={(checked) => setFormData({ ...formData, isVerified: checked })}
                    label="Email Verified"
                    description="Mark email as verified"
                    icon={<Icon component={Mail} />}
                />
                <ToggleSwitch
                    checked={formData.isMfaEnabled}
                    onChange={(checked) => setFormData({ ...formData, isMfaEnabled: checked })}
                    label="MFA Enabled"
                    description="Require MFA for login"
                    icon={<Icon component={Shield} />}
                />
            </Stack>
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
            maxWidth="sm"
            footer={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading || !password}>
                        {loading ? 'Saving...' : 'Update Password'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={2} sx={{ py: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: 'warning.light', border: '1px solid', borderColor: 'warning.main', borderRadius: 1 }}>
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                        <Icon component={AlertCircle} sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0, mt: 0.25 }} />
                        <Typography variant="caption" color="warning.dark">
                            Password must contain uppercase, lowercase, number, and special character.
                        </Typography>
                    </Stack>
                </Box>
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
              </Stack>
          </Modal>
    );
};

export const EditRolesModal: React.FC<EditModalProps & { roles: Role[]; tenants: Tenant[] }> = ({
    isOpen,
    onClose,
    onSave,
    user,
    loading,
    roles,
    tenants,
}) => {
    /** Per-tenant role IDs: tenantId -> roleIds[] */
    const [tenantRoleIds, setTenantRoleIds] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (isOpen && user.userAccesses?.length) {
            const next: Record<string, string[]> = {};
            for (const m of user.userAccesses) {
                next[m.tenantId] = m.roleIds ?? (Array.isArray(m.roles) ? m.roles.map((r: any) => (typeof r === 'string' ? r : r.id)) : []);
            }
            setTenantRoleIds(next);
        }
    }, [isOpen, user]);

    const handleSave = () => {
        const tenantRoles = Object.entries(tenantRoleIds).map(([tenantId, roleIds]) => ({
            tenantId,
            roleIds: roleIds ?? [],
        }));
        onSave({ tenantRoles } as any);
    };

    const updateRolesForTenant = (tenantId: string, roleIds: string[]) => {
        setTenantRoleIds((prev) => ({ ...prev, [tenantId]: roleIds }));
    };

    const accessTenants = (user.userAccesses ?? []).map((m) => ({
        tenantId: m.tenantId,
        tenant: m.tenant ?? tenants.find((t) => t.id === m.tenantId),
    }));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Roles by Tenant"
            maxWidth="sm"
            footer={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
{loading ? 'Saving...' : 'Save Changes'}
                      </Button>
                  </Stack>
              }
          >
            <Stack spacing={2} sx={{ py: 2, minHeight: 200 }}>
                {!accessTenants.length ? (
                    <Typography variant="body2" color="text.secondary">User has no tenants. Add tenants first, then assign roles.</Typography>
                ) : (
                    accessTenants.map(({ tenantId, tenant }) => (
                        <Box key={tenantId} sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'grey.50', p: 1.5 }}>
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight="500">
                                    {tenant?.name ?? tenant?.slug ?? tenantId}
                                </Typography>
                            </Box>
                            <MultiSelect
                                value={tenantRoleIds[tenantId] ?? []}
                                onChange={(roleIds) => updateRolesForTenant(tenantId, roleIds)}
                                options={roles
                                    .filter((r) => !r.tenantId || r.tenantId === tenantId)
                                    .map((r) => ({
                                        value: r.id,
                                        label: r.tenantId ? `${r.name} (${r.guard})` : `${r.name} (${r.guard}) – Global`,
                                    }))}
                                placeholder="Select roles..."
                            />
                        </Box>
                    ))
                )}
            </Stack>
        </Modal>
    );
};

export const EditTenantsModal: React.FC<EditModalProps & { tenants: Tenant[] }> = ({ isOpen, onClose, onSave, user, loading, tenants }) => {
    const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedTenants(user.userAccesses?.map((a) => a.tenant?.id) ?? []);
        }
    }, [isOpen, user]);

    const handleSave = () => {
        onSave({ tenantIds: selectedTenants } as any);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Tenants"
            maxWidth="sm"
            footer={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={2} sx={{ py: 2 }}>
                <MultiSelect
                    label="Tenants"
                    value={selectedTenants}
                    onChange={setSelectedTenants}
                    options={tenants.map((t) => ({
                        value: t.id,
                        label: `${t.name || t.slug || t.id}`,
                    }))}
                    placeholder="Select tenants..."
                />
            </Stack>
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
            maxWidth="md"
            footer={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
{loading ? 'Saving...' : 'Save Changes'}
                      </Button>
                  </Stack>
              }
          >
            <Box sx={{ py: 2 }}>
                <TextField
                    fullWidth
                    multiline
                    minRows={12}
                    value={metadataStr}
                    onChange={(e) => {
                        setMetadataStr(e.target.value);
                        try {
                            JSON.parse(e.target.value);
                            setError('');
                        } catch (err) {}
                    }}
                    placeholder='{"key": "value"}'
                    error={!!error}
                    helperText={error}
                    sx={{ fontFamily: 'monospace', '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                />
            </Box>
        </Modal>
    );
};

// Helper Toggle Component using MUI Switch
const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}> = ({ checked, onChange, disabled = false, label, description, icon }) => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, '&:hover': { bgcolor: 'grey.100' } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
            {icon && <Box sx={{ color: 'text.secondary' }}>{icon}</Box>}
            <Stack spacing={0.25}>
                <Typography variant="body2" fontWeight="500">{label}</Typography>
                {description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{description}</Typography>}
            </Stack>
        </Stack>
        <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} color="primary" />
    </Stack>
);
