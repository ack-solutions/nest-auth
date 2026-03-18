import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Box, Stack, TextField, Typography } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';

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
    onCancel,
    error,
    isEdit = false,
    originalName,
}) => {
    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        watch,
    } = useForm<PermissionFormData>({
        resolver: yupResolver(permissionSchema) as any,
        defaultValues: initialData || {
            name: '',
            guard: 'web',
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

    const handleCancel = () => {
        if (!isEdit) {
            reset();
        }
        onCancel();
    };

    return (
        <form id="permission-form" onSubmit={handleSubmit(handleFormSubmit)}>
            <Stack spacing={2} sx={{ p: 2 }}>
                {error && (
                    <Alert severity="error" variant="outlined">
                        {error}
                    </Alert>
                )}

                <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <TextField
                            id="perm-name"
                            label="Permission name"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            fullWidth
                            disabled={isSubmitting}
                            error={Boolean(errors.name)}
                            helperText={errors.name?.message || 'Use dot notation (e.g., users.create)'}
                            placeholder="users.create, posts.edit, admin.access…"
                        />
                    )}
                />

                <Controller
                    name="guard"
                    control={control}
                    render={({ field }) => (
                        <TextField
                            id="perm-guard"
                            label="Guard"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            fullWidth
                            disabled={isSubmitting}
                            error={Boolean(errors.guard)}
                            helperText={errors.guard?.message || 'Authentication context this permission applies to'}
                            placeholder="web, api, admin…"
                        />
                    )}
                />

                <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                        <TextField
                            id="perm-description"
                            label="Description (optional)"
                            value={field.value || ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            fullWidth
                            disabled={isSubmitting}
                            error={Boolean(errors.description)}
                            helperText={errors.description?.message}
                            placeholder="What does this permission allow?"
                            multiline
                            minRows={2}
                        />
                    )}
                />

                <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                        <Autocomplete
                            freeSolo
                            options={categories}
                            value={field.value || ''}
                            onChange={(_, newValue) => field.onChange(newValue || '')}
                            onInputChange={(_, newInput) => field.onChange(newInput)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    id="perm-category"
                                    label="Category (optional)"
                                    fullWidth
                                    disabled={isSubmitting}
                                    error={Boolean(errors.category)}
                                    helperText={errors.category?.message}
                                    placeholder="users, posts, admin, etc."
                                />
                            )}
                        />
                    )}
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
