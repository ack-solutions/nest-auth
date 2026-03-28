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

export interface CreatePermissionDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: PermissionFormData) => Promise<void>;
    categories: string[];
    error?: string;
}

export const CreatePermissionDialog: React.FC<CreatePermissionDialogProps> = ({
    open,
    onClose,
    onSubmit,
    categories,
    error,
}) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Icon component={Key} sx={{ fontSize: 18 }} />
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
