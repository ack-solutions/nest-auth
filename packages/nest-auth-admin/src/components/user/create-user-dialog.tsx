import React from 'react';
import { FormDialog } from '../form-dialog';
import type { Tenant, Role } from '../../types';
import { RHFSelect } from '../form/hook-form-fields/rhf-select';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Button, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { RHFTextField } from '../form/hook-form-fields/rhf-text-field';

export interface CreateUserDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: UserFormData) => Promise<void>;
    tenantMode: TenantMode;
    tenants: Tenant[];
    roles: Role[];
    error?: string;
    /** Backend has `platformAccess.enabled` — offer the platform-user option. */
    platformAccessEnabled?: boolean;
}


/**
 * Create user form data: shared = email only; isolated = email + tenantId.
 * `isPlatformUser` provisions a tenant-less platform (super-admin) account
 * instead — tenant selection does not apply to it.
 */
export interface UserFormData {
    email: string;
    tenantId?: string;
    isPlatformUser?: boolean;
}

const makeSchema = (requireTenantId: boolean) =>
    yup.object({
        email: yup.string().email('Invalid email address').required('Email is required'),
        // A platform user is tenant-less, so the tenant requirement lifts when it's checked.
        tenantId: requireTenantId
            ? yup.string().when('isPlatformUser', {
                is: true,
                then: (sch) => sch.optional(),
                otherwise: (sch) => sch.required('Tenant is required'),
            })
            : yup.string().optional(),
        isPlatformUser: yup.boolean().optional(),
    });

export type TenantMode = 'isolated' | 'shared' | null;


export const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
    open,
    onClose,
    onSubmit,
    tenantMode,
    tenants,
    platformAccessEnabled = false,
}) => {
    const isIsolated = tenantMode === 'isolated';
    const schema = React.useMemo(() => makeSchema(isIsolated), [isIsolated]);

    const methods = useForm<UserFormData>({
        resolver: yupResolver(schema) as any,
        defaultValues: {
            email: '',
            tenantId: '',
            isPlatformUser: false,
        },
    });

    const isPlatformUser = methods.watch('isPlatformUser');

    const handleFormSubmit = async (data: UserFormData) => {
        try {
            await onSubmit(data);
            methods.reset();
        } catch {
            // Error handled by parent
        }
    };

    return (
        <FormDialog
            formContext={methods}
            open={open}
            onClose={onClose}
            title="Create New User"
            maxWidth="md"
            onSuccess={handleFormSubmit}
            actions={
                <>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={onClose}
                        disabled={methods.formState.isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={methods.formState.isSubmitting}
                    >
                        Create
                    </Button>
                </>
            }
        >
            <Stack spacing={1.5} sx={{ p: 2 }}>
                <RHFTextField
                    name="email"
                    label="Email Address"
                    disabled={methods.formState.isSubmitting}
                    placeholder="user@example.com"
                />

                {platformAccessEnabled && (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!isPlatformUser}
                                onChange={(e) => methods.setValue('isPlatformUser', e.target.checked)}
                                disabled={methods.formState.isSubmitting}
                            />
                        }
                        label={
                            <Stack spacing={0.25}>
                                <Typography variant="body2">Platform user (super-admin)</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Creates a tenant-less account with platform access. Assign platform roles after creation.
                                </Typography>
                            </Stack>
                        }
                        sx={{ alignItems: 'flex-start', m: 0 }}
                    />
                )}

                {isPlatformUser && (
                    <Alert severity="info" sx={{ typography: 'caption' }}>
                        Platform users belong to no tenant. You can still add tenant memberships later
                        from the user's detail page — the two scopes are independent.
                    </Alert>
                )}

                {isIsolated && !isPlatformUser && (
                    <RHFSelect
                        name="tenantId"
                        label="Tenant"
                        options={[
                            { value: '', label: 'Select tenant...' },
                            ...tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` })),
                        ]}
                        placeholder="Select tenant..."
                        required
                        disabled={methods.formState.isSubmitting}
                    />
                )}

                {tenantMode === 'shared' && !isPlatformUser && (
                    <Typography variant="body2" color="text.secondary">
                        Tenant and roles can be assigned when editing the user after creation.
                    </Typography>
                )}
            </Stack>
        </FormDialog>
    );
};
