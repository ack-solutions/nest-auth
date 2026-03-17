import React, { useId } from 'react';
import MuiSelect from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';

interface MultiSelectProps {
    options: Array<{ value: string; label: string }>;
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    label?: string;
    name?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select options...',
    label,
    name,
}) => {
    const generatedId = useId();
    const id = name || generatedId;
    const labelId = `${id}-label`;

    return (
        <FormControl fullWidth size="small">
            {label && <InputLabel id={labelId}>{label}</InputLabel>}
            <MuiSelect
                id={id}
                labelId={labelId}
                multiple
                value={value}
                onChange={(e) => onChange(e.target.value as string[])}
                label={label}
                renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).length === 0 ? (
                            <span style={{ color: 'var(--mui-palette-text-secondary)' }}>{placeholder}</span>
                        ) : (
                            (selected as string[]).map((val) => {
                                const opt = options.find((o) => o.value === val);
                                return (
                                    <Chip
                                        key={val}
                                        label={opt?.label ?? val}
                                        size="small"
                                        onDelete={() => onChange(value.filter((v) => v !== val))}
                                    />
                                );
                            })
                        )}
                    </Box>
                )}
            >
                {options.length === 0 ? (
                    <MenuItem disabled>No options available</MenuItem>
                ) : (
                    options.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            {option.label}
                        </MenuItem>
                    ))
                )}
            </MuiSelect>
        </FormControl>
    );
};
