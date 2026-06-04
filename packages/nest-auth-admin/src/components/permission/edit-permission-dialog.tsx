import React from 'react';
import { Key } from 'lucide-react';
import Icon from '@mui/material/Icon';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { PermissionForm, PermissionFormData } from './permission-form';
import type { Permission } from '../../types';

export interface EditPermissionDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: PermissionFormData) => Promise<void>;
    permission: Permission;
    categories: string[];
    error?: string;
}

export const EditPermissionDialog: React.FC<EditPermissionDialogProps> = ({
    open,
    onClose,
    onSubmit,
    permission,
    categories,
    error,
}) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Icon component={Key} sx={{ fontSize: 18 }} />
                    <Typography variant="h6">Edit permission</Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5 }} color="text.secondary">
                    Update permission details
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <PermissionForm
                    initialData={{
                        name: permission.name,
                        guard: permission.guard,
                        description: permission.description || '',
                        category: permission.category || '',
                    }}
                    categories={categories}
                    onSubmit={onSubmit}
                    onCancel={onClose}
                    error={error}
                    isEdit={true}
                    originalName={permission.name}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="outlined">
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="permission-form"
                    variant="contained"
                >
                    Update permission
                </Button>
            </DialogActions>
        </Dialog>
    );
};
