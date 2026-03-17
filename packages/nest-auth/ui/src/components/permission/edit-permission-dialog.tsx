import React, { useState } from 'react';
import { Key } from 'lucide-react';
import { FormDialog } from '../form-dialog';
import { PermissionForm, PermissionFormData } from './permission-form';
import type { FormFooterAction } from '../form-footer';
import type { Permission } from '../../types';

export interface EditPermissionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: PermissionFormData) => Promise<void>;
    permission: Permission;
    categories: string[];
    error?: string;
}

export const EditPermissionDialog: React.FC<EditPermissionDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    permission,
    categories,
    error,
}) => {
    const [actions, setActions] = useState<FormFooterAction[]>([]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Permission"
            description="Update permission details"
            icon={<Key className="w-5 h-5 text-primary-600" />}
            maxWidth="lg"
            actions={actions}
        >
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
                submitLabel="Update Permission"
                isEdit={true}
                originalName={permission.name}
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};
