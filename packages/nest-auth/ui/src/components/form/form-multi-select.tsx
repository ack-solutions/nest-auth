import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Box, FormHelperText, Typography } from '@mui/material';
import { MultiSelect } from '../multi-select';

interface FormMultiSelectProps {
    name: string;
    label?: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    helperText?: string;
}

export const FormMultiSelect: React.FC<FormMultiSelectProps> = ({
    name,
    label,
    options,
    placeholder = 'Select options...',
    helperText,
}) => {
    const { control, formState: { errors } } = useFormContext();
    const error = errors[name];

    return (
        <Box sx={{ width: '100%' }}>
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <MultiSelect
                        label={label}
                        value={field.value || []}
                        onChange={field.onChange}
                        options={options}
                        placeholder={placeholder}
                    />
                )}
            />
            {error && (
                <FormHelperText error sx={{ mt: 0.5 }}>{error.message as string}</FormHelperText>
            )}
            {helperText && !error && (
                <FormHelperText sx={{ mt: 0.5 }}>{helperText}</FormHelperText>
            )}
        </Box>
    );
};
