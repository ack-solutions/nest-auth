import * as yup from 'yup';

export interface TenantFormData {
    name: string;
    slug: string;
    description?: string;
}

export const tenantSchema = yup.object({
    name: yup.string().required('Tenant name is required').min(1, 'Tenant name cannot be empty'),
    slug: yup
        .string()
        .required('Slug is required')
        .matches(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
        .min(1, 'Slug cannot be empty'),
    description: yup.string().optional(),
});

export const tenantEmptyValues: TenantFormData = {
    name: '',
    slug: '',
    description: '',
};
