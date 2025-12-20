import React, { useState } from 'react';
import { FormDialog } from '../FormDialog';
import { UserForm, UserFormData } from './UserForm';
import type { FormFooterAction } from '../FormFooter';
import type { Tenant, Role } from '../../types';

export interface CreateUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: UserFormData) => Promise<void>;
    tenants: Tenant[];
    roles: Role[];
    error?: string;
}

export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    tenants,
    roles,
    error,
}) => {
    const [actions, setActions] = useState<FormFooterAction[]>([]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Create New User"
            maxWidth="md"
            actions={actions}
        >
            <UserForm
                tenants={tenants}
                roles={roles}
                onSubmit={onSubmit}
                onCancel={onClose}
                error={error}
                submitLabel="Create User"
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};
