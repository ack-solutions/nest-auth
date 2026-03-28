import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { RHFTextField } from '../form/rhf-text-field';
import { RHFSelect } from '../form/rhf-select';
import { RHFAutocompleteFreeSolo } from '../form/rhf-autocomplete-free-solo';
import { useRoleGuards } from '../../hooks/use-role-guards';

export interface PermissionFormData {
    name: string;
    guard: string;
    description?: string;
    category?: string;
}

const permissionSchema = yup.object({
    name: yup.string().required('Permission name is required').min(1, 'Permission name cannot be empty'),
    guard: yup.string().required('Guard is required').min(1, 'Guard cannot be empty'),
    description: yup.string().optional(),
    category: yup.string().optional(),
});

export interface PermissionFormProps {
    initialData?: Partial<PermissionFormData>;
    categories: string[];
    onSubmit: (data: PermissionFormData) => Promise<void>;
    onCancel: () => void;
    error?: string;
    isEdit?: boolean;
    originalName?: string;
}

export const PermissionForm: React.FC<PermissionFormProps> = ({
    initialData,
    categories,
    onSubmit,
    onCancel: _onCancel,
    error,
    isEdit = false,
    originalName,
}) => {
    const { guardOptions, helperText: guardHelperText } = useRoleGuards();
    const {
        control,
        handleSubmit,
        formState: { isSubmitting },
        reset,
        watch,
    } = useForm<PermissionFormData>({
        resolver: yupResolver(permissionSchema) as any,
        defaultValues: initialData || {
            name: '',
            guard: guardOptions[0]?.value ?? 'web',
            description: '',
            category: '',
        },
    });

    const name = watch('name');
    const nameChanged = isEdit && name.trim() !== (originalName || '');

    // Reset form when initialData changes (for edit mode)
    React.useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

    const handleFormSubmit = async (data: PermissionFormData) => {
        try {
            await onSubmit(data);
            if (!isEdit) {
                reset();
            }
        } catch (err) {
            // Error handled by parent
        }
    };

    return (
        <form id="permission-form" onSubmit={handleSubmit(handleFormSubmit)}>
            <Stack spacing={2} sx={{ p: 2 }}>
                {error && (
                    <Alert severity="error" variant="outlined">
                        {error}
                    </Alert>
                )}

                <RHFTextField
                    name="name"
                    control={control}
                    id="perm-name"
                    label="Permission name"
                    disabled={isSubmitting}
                    helperText="Use dot notation (e.g., users.create)"
                    placeholder="users.create, posts.edit, admin.access…"
                />

                <RHFSelect
                    name="guard"
                    control={control}
                    label="Guard"
                    options={guardOptions}
                    placeholder="Select guard"
                    allowEmpty={false}
                    disabled={isSubmitting}
                    caption={guardHelperText}
                />

                <RHFTextField
                    name="description"
                    control={control}
                    id="perm-description"
                    label="Description (optional)"
                    disabled={isSubmitting}
                    placeholder="What does this permission allow?"
                    multiline
                    minRows={2}
                />

                <RHFAutocompleteFreeSolo
                    name="category"
                    control={control}
                    options={categories}
                    label="Category (optional)"
                    placeholder="users, posts, admin, etc."
                    disabled={isSubmitting}
                    id="perm-category"
                />

                {isEdit && (
                    <Box
                        sx={{
                            p: 1.5,
                            bgcolor: 'info.light',
                            border: '1px solid',
                            borderColor: 'info.main',
                            borderRadius: 1,
                        }}
                    >
                        <Typography variant="caption" fontWeight={600} color="info.dark" sx={{ display: 'block', mb: 0.5 }}>
                            Note
                        </Typography>
                        <Typography variant="caption" color="info.dark">
                            {nameChanged
                                ? `Renaming this permission updates every assigned role automatically (${originalName} → ${name.trim()}).`
                                : 'Roles reference permission records through a role-permission relation, so changes here are reflected anywhere the permission is assigned.'}
                        </Typography>
                    </Box>
                )}
            </Stack>
        </form>
    );
};
