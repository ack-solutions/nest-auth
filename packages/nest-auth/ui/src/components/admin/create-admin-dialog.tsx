import React from 'react';
import { FormDialog } from '../form-dialog';
import { AdminFormData } from './admin-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { Button } from '@mui/material';
import { RHFTextField } from '../form/hook-form-fields/rhf-text-field';
import { RHFPasswordField } from '../form/hook-form-fields/rhf-password-field';

export interface CreateAdminDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: AdminFormData) => Promise<void>;
    error?: string;
}

const adminSchema = yup.object({
    email: yup.string().email('Invalid email address').required('Email is required'),
    name: yup.string().optional(),
    password: yup
        .string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be less than 128 characters')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/\d/, 'Password must contain at least one number')
        .matches(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)'),
});


const defaultValues: AdminFormData = {
    email: '',
    name: '',
    password: '',
};


export const CreateAdminDialog: React.FC<CreateAdminDialogProps> = ({
    open,
    onClose,
    onSubmit,
    error,
}) => {

    const methods = useForm<AdminFormData>({
        resolver: yupResolver(adminSchema) as any,
        defaultValues,
    });

    return (
        <FormDialog
            formContext={methods}
            open={open}
            onClose={onClose}
            title="Create Admin Account"
            maxWidth="md"
            actions={
                <>
                    <Button
                        variant="outlined"
                        color="primary"
                        disabled={methods.formState.isSubmitting}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        disabled={methods.formState.isSubmitting}
                        onClick={methods.handleSubmit(onSubmit)}
                    >
                        Create Admin
                    </Button>
                </>
            }
        >
            <RHFTextField
                name="email"
                label="Email Address"
                disabled={methods.formState.isSubmitting}
                placeholder="admin@example.com"
            />

            <RHFTextField
                name="name"
                label="Name (Optional)"
                disabled={methods.formState.isSubmitting}
                placeholder="Admin User"
            />

            <RHFPasswordField
                name="password"
                label="Password"
                disabled={methods.formState.isSubmitting}
                showGenerateButton={true}
                showStrengthIndicator={true}
            />
        </FormDialog>
    );
};
