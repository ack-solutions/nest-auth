import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { FormDialog } from '../form-dialog';
import { TenantForm, TenantFormData } from './tenant-form';
import type { FormFooterAction } from '../form-footer';

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
            icon={<Icon component={Building2} sx={{ color: 'primary.main' }} />}
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
