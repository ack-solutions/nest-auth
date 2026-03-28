import { useEffect, useState } from 'react';
import { Mail, Shield, CheckCircle } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { Dialog } from '../../dialog';
import type { EditModalProps } from './types';
import { ToggleSwitchRow } from './toggle-switch-row';

export function EditStatusSecurityModal({ open, onClose, onSave, user, loading }: EditModalProps) {
    const [formData, setFormData] = useState({
        isActive: user.isActive,
        isVerified: user.isVerified,
        isMfaEnabled: user.isMfaEnabled,
    });

    useEffect(() => {
        if (open) {
            setFormData({
                isActive: user.isActive,
                isVerified: user.isVerified,
                isMfaEnabled: user.isMfaEnabled,
            });
        }
    }, [open, user]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Edit Status & Security"
            maxWidth="sm"
            actions={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" onClick={() => onSave(formData)} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={1.5} sx={{ py: 2 }}>
                <ToggleSwitchRow
                    checked={formData.isActive}
                    onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    label="Account Active"
                    description="Allow user to sign in"
                    icon={<Icon component={CheckCircle} />}
                />
                <ToggleSwitchRow
                    checked={formData.isVerified}
                    onChange={(checked) => setFormData({ ...formData, isVerified: checked })}
                    label="Email Verified"
                    description="Mark email as verified"
                    icon={<Icon component={Mail} />}
                />
                <ToggleSwitchRow
                    checked={formData.isMfaEnabled}
                    onChange={(checked) => setFormData({ ...formData, isMfaEnabled: checked })}
                    label="MFA Enabled"
                    description="Require MFA for login"
                    icon={<Icon component={Shield} />}
                />
            </Stack>
        </Dialog>
    );
}
