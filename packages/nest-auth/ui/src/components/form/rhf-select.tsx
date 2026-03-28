import React from 'react';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export type RHFSelectProps<T extends FieldValues> = {
    name: FieldPath<T>;
    control: Control<T>;
    options: Array<{ value: string; label: string }>;
    label?: string;
    placeholder?: string;
    allowEmpty?: boolean;
    required?: boolean;
    disabled?: boolean;
    id?: string;
    /** Non-error helper shown below the field */
    caption?: React.ReactNode;
};

export function RHFSelect<T extends FieldValues>({
    name,
    control,
    options,
    label,
    placeholder = 'Select…',
    allowEmpty = true,
    required = false,
    disabled,
    id,
    caption,
}: RHFSelectProps<T>) {
    const needsSyntheticEmpty = allowEmpty && !options.some((o) => o.value === '');

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error: fieldError } }) => (
                <Box>
                    <TextField
                        select
                        fullWidth
                        id={id}
                        label={label}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        required={required}
                        disabled={disabled}
                        error={!!fieldError}
                        helperText={fieldError?.message as string | undefined}
                        slotProps={{
                            select: {
                                displayEmpty: allowEmpty,
                                renderValue: (v) => {
                                    const opt = options.find((o) => o.value === v);
                                    if (opt) return opt.label;
                                    if (allowEmpty && (v === '' || v === undefined)) {
                                        return <em>{placeholder}</em>;
                                    }
                                    return String(v ?? '');
                                },
                            }
                        }}
                    >
                        {needsSyntheticEmpty && (
                            <MenuItem value="">
                                <em>{placeholder}</em>
                            </MenuItem>
                        )}
                        {options.map((option) => (
                            <MenuItem key={option.value === '' ? '__empty' : option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                    {caption && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {caption}
                        </Typography>
                    )}
                </Box>
            )}
        />
    );
}
