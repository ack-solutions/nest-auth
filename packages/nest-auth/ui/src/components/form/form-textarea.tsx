import React from 'react';
import { useFormContext, FieldError } from 'react-hook-form';
import { TextField } from '@mui/material';

interface FormTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> {
    name: string;
    label?: string;
    helperText?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
    name,
    label,
    helperText,
    ...props
}) => {
    const { register, formState: { errors } } = useFormContext();
    const error = errors[name] as FieldError | undefined;

    return (
        <TextField
            id={name}
            {...register(name)}
            label={label}
            multiline
            minRows={3}
            fullWidth
            size="small"
            error={!!error}
            helperText={error?.message ?? (helperText && !error ? helperText : undefined)}
            {...props}
        />
    );
};
