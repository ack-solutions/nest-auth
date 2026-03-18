import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import Icon from '@mui/material/Icon';
import { FormDialog } from '../form-dialog';
import { TenantForm, TenantFormData } from './tenant-form';
import type { FormFooterAction } from '../form-footer';
import type { Tenant } from '../../types';

export interface EditTenantDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: TenantFormData) => Promise<void>;
    tenant: Tenant;
    error?: string;
}

export const EditTenantDialog: React.FC<EditTenantDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    tenant,
    error,
}) => {
    const [actions, setActions] = useState<FormFooterAction[]>([]);

    return (
        <FormDialog
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Tenant"
            description="Update tenant name, slug, and description"
            icon={<Icon component={Building2} sx={{ color: 'primary.main' }} />}
            maxWidth="md"
            actions={actions}
        >
            <TenantForm
                initialData={{
                    name: tenant.name,
                    slug: tenant.slug,
                    description: tenant.description || '',
                }}
                onSubmit={onSubmit}
                onCancel={onClose}
                error={error}
                submitLabel="Update Tenant"
                isEdit={true}
                onActionsReady={setActions}
            />
        </FormDialog>
    );
};


