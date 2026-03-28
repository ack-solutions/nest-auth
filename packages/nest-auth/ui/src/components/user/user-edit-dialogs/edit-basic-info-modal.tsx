import { useEffect, useState } from 'react';
import PhoneIcon from '@mui/icons-material/Phone';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { Dialog } from '../../dialog';
import type { EditModalProps } from './types';

export function EditBasicInfoModal({ open, onClose, onSave, user, loading }: EditModalProps) {
    const [formData, setFormData] = useState({
        email: user.email,
        phone: user.phone || '',
    });

    useEffect(() => {
        if (open) {
            setFormData({
                email: user.email,
                phone: user.phone || '',
            });
        }
    }, [open, user]);

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Edit Basic Information"
            maxWidth="sm"
            actions={
                <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Stack>
            }
        >
            <Stack spacing={2} sx={{ py: 2 }}>
                <TextField
                    type="email"
                    label="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                    fullWidth
                />
                <TextField
                    label="Phone Number"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1234567890"
                    fullWidth
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <PhoneIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </Stack>
        </Dialog>
    );
}
