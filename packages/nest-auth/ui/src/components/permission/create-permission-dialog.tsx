import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { FormDialog } from '../form-dialog';
import { PermissionForm, PermissionFormData } from './permission-form';
import type { FormFooterAction } from '../form-footer';

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
    const [actions, setActions] = useState<FormFooterAction[]>([]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Create New Permission"
            description="Add a permission to the registry for autocomplete suggestions"
            icon={<Key className="w-5 h-5 text-primary-600" />}
            maxWidth="lg"
            actions={actions}
        >
            <PermissionForm
                categories={categories}
                onSubmit={onSubmit}
                onCancel={onClose}
                error={error}
                submitLabel="Create Permission"
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};
