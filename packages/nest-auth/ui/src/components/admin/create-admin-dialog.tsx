import React, { useState } from 'react';
import { FormDialog } from '../form-dialog';
import { AdminForm, AdminFormData } from './admin-form';
import type { FormFooterAction } from '../form-footer';

export interface CreateAdminDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AdminFormData) => Promise<void>;
    error?: string;
}

export const CreateAdminDialog: React.FC<CreateAdminDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    error,
}) => {
    const [actions, setActions] = useState<FormFooterAction[]>([]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Create Admin Account"
            maxWidth="md"
            actions={actions}
        >
            <AdminForm
                onSubmit={onSubmit}
                onCancel={onClose}
                error={error}
                submitLabel="Create Admin"
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};
