import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { FormDialog } from '../FormDialog';
import { TenantForm, TenantFormData } from './TenantForm';
import type { FormFooterAction } from '../FormFooter';

export interface CreateTenantDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: TenantFormData) => Promise<void>;
    error?: string;
}

export const CreateTenantDialog: React.FC<CreateTenantDialogProps> = ({
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
            title="Create New Tenant"
            description="Add a new tenant workspace"
            icon={<Building2 className="w-5 h-5 text-primary-600" />}
            maxWidth="md"
            actions={actions}
        >
            <TenantForm
                onSubmit={onSubmit}
                onCancel={onClose}
                error={error}
                submitLabel="Create Tenant"
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};
