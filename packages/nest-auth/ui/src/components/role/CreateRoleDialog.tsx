import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { FormDialog } from '../FormDialog';
import { RoleForm, RoleFormData } from './RoleForm';
import type { FormFooterAction } from '../FormFooter';
import type { Tenant } from '../../types';

export interface CreateRoleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RoleFormData) => Promise<void>;
    tenants: Tenant[];
    error?: string;
}

export const CreateRoleDialog: React.FC<CreateRoleDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    tenants,
    error,
}) => {
    const [actions, setActions] = useState<FormFooterAction[]>([]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Create New Role"
            description="Define a new role with specific permissions"
            icon={<Shield className="w-5 h-5 text-primary-600" />}
            maxWidth="2xl"
            actions={actions}
        >
            <RoleForm
                tenants={tenants}
                onSubmit={onSubmit}
                onCancel={onClose}
                error={error}
                submitLabel="Create Role"
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};
