import React, { useId } from 'react';
import MuiSelect from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

interface SelectProps {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
    allowEmpty?: boolean;
    id?: string;
    disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    label,
    required = false,
    allowEmpty = true,
    id: providedId,
    disabled = false,
}) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const labelId = `${id}-label`;

    return (
        <FormControl fullWidth size="small" required={required} disabled={disabled}>
            {label && (
                <InputLabel id={labelId} htmlFor={id}>
                    {label}
                </InputLabel>
            )}
            <MuiSelect
                id={id}
                labelId={labelId}
                value={value}
                label={label}
                onChange={(e) => onChange(e.target.value as string)}
                displayEmpty={allowEmpty}
                renderValue={(v) => {
                    if (!v) return placeholder;
                    const opt = options.find((o) => o.value === v);
                    return opt?.label ?? v;
                }}
            >
                {allowEmpty && (
                    <MenuItem value="">
                        <em>{placeholder}</em>
                    </MenuItem>
                )}
                {options.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </MuiSelect>
        </FormControl>
    );
};
