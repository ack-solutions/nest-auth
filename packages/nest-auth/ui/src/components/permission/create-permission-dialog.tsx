import React from 'react';
import { Key } from 'lucide-react';
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

export interface CreatePermissionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: PermissionFormData) => Promise<void>;
    categories: string[];
    error?: string;
}

export const CreatePermissionDialog: React.FC<CreatePermissionDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    categories,
    error,
}) => {
    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Key size={18} />
                    <Typography variant="h6">Create new permission</Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.5 }} color="text.secondary">
                    Add a permission to the registry for autocomplete suggestions
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <PermissionForm
                    categories={categories}
                    onSubmit={onSubmit}
                    onCancel={onClose}
                    error={error}
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
                    Create permission
                </Button>
            </DialogActions>
        </Dialog>
    );
};
