import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { FormDialog } from '../form-dialog';
import { RoleForm, RoleFormData } from './role-form';
import type { FormFooterAction } from '../form-footer';
import type { Tenant, Role } from '../../types';

export interface EditRoleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RoleFormData) => Promise<void>;
    role: Role;
    tenants: Tenant[];
    error?: string;
}

export const EditRoleDialog: React.FC<EditRoleDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    role,
    tenants,
    error,
}) => {
    const [actions, setActions] = useState<FormFooterAction[]>([]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Role"
            description="Update role name, guard, and permissions"
            icon={<Shield className="w-5 h-5 text-primary-600" />}
            maxWidth="2xl"
            actions={actions}
        >
            <RoleForm
                initialData={{
                    name: role.name,
                    guard: role.guard,
                    tenantId: role.tenantId || '',
                    permissions: role.permissions || [],
                }}
                tenants={tenants}
                onSubmit={onSubmit}
                onCancel={onClose}
                error={error}
                submitLabel="Update Role"
                isEdit={true}
                isSystemRole={role.isSystem}
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};
