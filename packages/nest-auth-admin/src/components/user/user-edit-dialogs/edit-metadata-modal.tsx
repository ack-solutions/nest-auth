import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { Dialog } from '../../dialog';
import type { User } from '../../../types';
import type { EditModalProps } from './types';

export function EditMetadataModal({ open, onClose, onSave, user, loading }: EditModalProps) {
    const [metadataStr, setMetadataStr] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            setMetadataStr(JSON.stringify(user.metadata || {}, null, 2));
            setError('');
        }
    }, [open, user]);

    const handleSave = () => {
        try {
            const parsed = JSON.parse(metadataStr);
            onSave({ metadata: parsed } as Partial<User>);
        } catch {
            setError('Invalid JSON format');
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Edit Metadata"
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
                        } catch {
                            /* invalid while typing */
                        }
                    }}
                    placeholder='{"key": "value"}'
                    error={!!error}
                    helperText={error}
                    sx={{ fontFamily: 'monospace', '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                />
            </Box>
        </Dialog>
    );
}
