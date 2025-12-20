import React, { useState } from 'react';
import { FormDialog } from '../FormDialog';
import { AdminForm, AdminFormData } from './AdminForm';
import type { FormFooterAction } from '../FormFooter';

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
