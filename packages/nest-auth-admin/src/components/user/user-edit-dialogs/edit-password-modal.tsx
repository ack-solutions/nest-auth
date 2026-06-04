import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { PasswordStrengthLinearMeter } from '../../auth/components/password-strength-indicator';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Dialog } from '../../dialog';
import type { User } from '../../../types';
import type { EditModalProps } from './types';

export function EditPasswordModal({ open, onClose, onSave, loading }: EditModalProps) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (open) {
            setPassword('');
            setError('');
            setShowPassword(false);
        }
    }, [open]);

    const handleSave = () => {
        if (!password) {
            setError('Password is required');
            return;
        }
        onSave({ password } as Partial<User>);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Change Password"
            maxWidth="sm"
            actions={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading || !password}>
                        {loading ? 'Saving...' : 'Update Password'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={2} sx={{ py: 2 }}>
                <Box
                    sx={{
                        p: 1.5,
                        bgcolor: 'warning.light',
                        border: '1px solid',
                        borderColor: 'warning.main',
                        borderRadius: 1,
                    }}
                >
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                        <Icon component={AlertCircle} sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0, mt: 0.25 }} />
                        <Typography variant="caption" color="warning.dark">
                            Password must contain uppercase, lowercase, number, and special character.
                        </Typography>
                    </Stack>
                </Box>
                <TextField
                    id="new-password"
                    label="New Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                    }}
                    error={!!error}
                    helperText={error}
                    fullWidth
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        onClick={() => setShowPassword((s) => !s)}
                                        edge="end"
                                        size="small"
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                {!!password && <PasswordStrengthLinearMeter password={password} />}
            </Stack>
        </Dialog>
    );
}
