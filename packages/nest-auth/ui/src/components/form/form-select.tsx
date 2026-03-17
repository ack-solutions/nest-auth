import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material';

interface FormSelectProps {
    name: string;
    label?: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    helperText?: string;
    required?: boolean;
    allowEmpty?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
    name,
    label,
    options,
    placeholder = 'Select an option...',
    helperText,
    required = false,
    allowEmpty = true,
}) => {
    const { control, formState: { errors } } = useFormContext();
    const error = errors[name];

    return (
        <Controller
            name={name}
            control={control}
            render={({ field }) => (
                <FormControl fullWidth size="small" error={!!error}>
                    {label && (
                        <InputLabel id={`${name}-label`}>{label}{required ? ' *' : ''}</InputLabel>
                    )}
                    <Select
                        {...field}
                        value={field.value ?? ''}
                        labelId={label ? `${name}-label` : undefined}
                        id={name}
                        label={label ? `${label}${required ? ' *' : ''}` : undefined}
                        displayEmpty
                        renderValue={(v) => {
                            const selected = options.find((o) => o.value === v);
                            return selected ? selected.label : placeholder;
                        }}
                    >
                        {allowEmpty && <MenuItem value="">{placeholder}</MenuItem>}
                        {options.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                    {error && <FormHelperText>{error.message as string}</FormHelperText>}
                    {helperText && !error && <FormHelperText>{helperText}</FormHelperText>}
                </FormControl>
            )}
        />
    );
};
