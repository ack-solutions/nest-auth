import React, { ReactNode, forwardRef } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

export interface FormFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
    type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'search';
    error?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    autoComplete?: string;
    maxLength?: number;
    minLength?: number;
    className?: string;
    startIcon?: ReactNode;
    endActions?: ReactNode;
    helpText?: string | ReactNode;
    inputClassName?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({
    id,
    label,
    value,
    onChange,
    onBlur,
    type = 'text',
    error,
    placeholder,
    disabled = false,
    required = false,
    autoComplete,
    maxLength,
    minLength,
    className,
    startIcon,
    endActions,
    helpText,
}, ref) => (
    <Box className={className}>
        <TextField
            inputRef={ref}
            id={id}
            label={label}
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            autoComplete={autoComplete}
            inputProps={{ maxLength, minLength }}
            error={!!error}
            helperText={error || (helpText && !error && typeof helpText === 'string' ? helpText : undefined)}
            fullWidth
            size="small"
            InputProps={{
                startAdornment: startIcon ? (
                    <InputAdornment position="start">{startIcon}</InputAdornment>
                ) : undefined,
                endAdornment: endActions ? (
                    <InputAdornment position="end">{endActions}</InputAdornment>
                ) : undefined,
            }}
        />
        {helpText && !error && typeof helpText !== 'string' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {helpText}
            </Typography>
        )}
    </Box>
));

FormField.displayName = 'FormField';
