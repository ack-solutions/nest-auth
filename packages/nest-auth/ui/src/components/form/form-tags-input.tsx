import React from 'react';
import { useFormContext, Controller, FieldError } from 'react-hook-form';
import { Box, FormHelperText } from '@mui/material';
import { TagsInput } from '../tags-input';

interface FormTagsInputProps {
    name: string;
    label?: string;
    placeholder?: string;
    helperText?: string;
}

export const FormTagsInput: React.FC<FormTagsInputProps> = ({
    name,
    label,
    placeholder = 'Type and press Enter...',
    helperText,
}) => {
    const { control, formState: { errors } } = useFormContext();
    const error = errors[name] as FieldError | undefined;
    const errorString = typeof error?.message === 'string' ? error.message : null;

    return (
        <Box sx={{ width: '100%' }}>
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <TagsInput
                        label={label}
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder={placeholder}
                        helperText={helperText && !errorString ? helperText : undefined}
                    />
                )}
            />
            {errorString && (
                <FormHelperText error sx={{ mt: 0.5 }}>{errorString}</FormHelperText>
            )}
        </Box>
    );
};
