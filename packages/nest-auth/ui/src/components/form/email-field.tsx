import React from 'react';
import MailIcon from '@mui/icons-material/Mail';
import { FormField, FormFieldProps } from './form-field';

export interface EmailFieldProps extends Omit<FormFieldProps, 'type' | 'startIcon'> {
    autoComplete?: 'username' | 'email';
}

export const EmailField: React.FC<EmailFieldProps> = ({
    autoComplete = 'email',
    ...props
}) => (
    <FormField
        {...props}
        type="email"
        startIcon={<MailIcon fontSize="small" color="action" />}
        autoComplete={autoComplete}
    />
);
