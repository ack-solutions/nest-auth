import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import { Dialog } from '../../dialog';
import type { Tenant, User } from '../../../types';
import type { EditModalProps } from './types';

export interface EditTenantsModalProps extends EditModalProps {
    tenants: Tenant[];
}

export function EditTenantsModal({ open, onClose, onSave, user, loading, tenants }: EditTenantsModalProps) {
    const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
    const tenantOptions = tenants.map((t) => ({
        value: t.id,
        label: `${t.name || t.slug || t.id}`,
    }));

    useEffect(() => {
        if (open) {
            setSelectedTenants(
                user.userAccesses?.map((a) => a.tenant?.id).filter((id): id is string => Boolean(id)) ?? [],
            );
        }
    }, [open, user]);

    const handleSave = () => {
        onSave({ tenantIds: selectedTenants } as Partial<User>);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Manage Tenants"
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
                    select
                    fullWidth
                    label="Tenants"
                    value={selectedTenants}
                    onChange={(e) => {
                        const raw = e.target.value;
                        setSelectedTenants(Array.isArray(raw) ? raw : [raw]);
                    }}
                    SelectProps={{
                        multiple: true,
                        renderValue: (selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {(selected as string[]).length === 0 ? (
                                    <Box component="span" sx={{ color: 'text.secondary' }}>
                                        Select tenants...
                                    </Box>
                                ) : (
                                    (selected as string[]).map((val) => {
                                        const opt = tenantOptions.find((o) => o.value === val);
                                        return (
                                            <Chip
                                                key={val}
                                                label={opt?.label ?? val}
                                                size="small"
                                                onDelete={(ev) => {
                                                    ev.stopPropagation();
                                                    setSelectedTenants((prev) => prev.filter((v) => v !== val));
                                                }}
                                                onMouseDown={(ev) => ev.stopPropagation()}
                                            />
                                        );
                                    })
                                )}
                            </Box>
                        ),
                    }}
                >
                    {tenantOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))}
                </TextField>
            </Stack>
        </Dialog>
    );
}
