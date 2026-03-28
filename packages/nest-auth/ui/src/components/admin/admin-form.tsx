import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Typography } from '@mui/material';
import { RHFPasswordField } from '../form/hook-form-fields/rhf-password-field';
import { RHFTextField } from '../form/hook-form-fields/rhf-text-field';
import { CheckCircle } from 'lucide-react';
import Icon from '@mui/material/Icon';

export interface AdminFormData {
    email: string;
    name: string;
    password: string;
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

export interface AdminFormProps {
    initialData?: Partial<AdminFormData>;
    onSubmit: (data: AdminFormData) => Promise<void>;
    onCancel: () => void;
    error?: string;
    submitLabel?: string;
    onActionsReady?: (actions: FormFooterAction[]) => void;
}

export const AdminForm: React.FC<AdminFormProps> = ({
    initialData,
    onSubmit,
    onCancel,
    error,
    submitLabel = 'Create Admin',
    onActionsReady,
}) => {
    const {
        control,
        handleSubmit,
        formState: { isSubmitting },
        reset,
    } = useForm<AdminFormData>({
        resolver: yupResolver(adminSchema) as any,
        defaultValues: initialData || {
            email: '',
            name: '',
            password: '',
        },
    });

    const handleFormSubmit = async (data: AdminFormData) => {
        try {
            await onSubmit(data);
            reset();
        } catch (err) {
            // Error is handled by parent
        }
    };

    const handleCancel = () => {
        reset();
        onCancel();
    };

    // Prepare footer actions
    const footerActions: FormFooterAction[] = React.useMemo(() => [
        {
            label: 'Cancel',
            onClick: handleCancel,
            variant: 'secondary' as const,
            disabled: isSubmitting,
        },
        {
            label: isSubmitting
                ? (submitLabel.includes('Creating') ? 'Creating...' : 'Updating...')
                : submitLabel,
            onClick: () => {
                const form = document.getElementById('admin-form') as HTMLFormElement;
                if (form) {
                    form.requestSubmit();
                }
            },
            variant: 'primary' as const,
            disabled: isSubmitting,
            icon: isSubmitting ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
                <Icon component={CheckCircle} />
            ),
        },
    ], [handleCancel, isSubmitting, submitLabel]);

    // Notify parent of actions
    React.useEffect(() => {
        if (onActionsReady) {
            onActionsReady(footerActions);
        }
    }, [onActionsReady, footerActions]);

    return (
        <form id="admin-form" onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-3">
            <RHFTextField
                name="email"
                label="Email Address"
                disabled={isSubmitting}
                placeholder="admin@example.com"
            />

            <RHFTextField
                name="name"
                label="Name (Optional)"
                disabled={isSubmitting}
                placeholder="Admin User"
            />

            <RHFPasswordField
                name="password"
                label="Password"
                disabled={isSubmitting}
                showGenerateButton={true}
                showStrengthIndicator={true}
            />
        </form>
    );
};
