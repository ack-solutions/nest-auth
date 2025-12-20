import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { FormDialog } from '../FormDialog';
import { TenantForm, TenantFormData } from './TenantForm';
import type { FormFooterAction } from '../FormFooter';
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
            icon={<Building2 className="w-5 h-5 text-primary-600" />}
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


