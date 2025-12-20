import React from 'react';
import { Mail } from 'lucide-react';
import { FormField, FormFieldProps } from './FormField';

export interface EmailFieldProps extends Omit<FormFieldProps, 'type' | 'startIcon'> {
    autoComplete?: 'username' | 'email';
}

/**
 * Email field wrapper - uses FormField with email type and Mail icon
 * All rendering logic is in FormField (single source of truth)
 */
export const EmailField: React.FC<EmailFieldProps> = ({
    autoComplete = 'email',
    ...props
}) => {
    return (
        <FormField
            {...props}
            type="email"
            startIcon={<Mail className="h-5 w-5 text-gray-400" />}
            autoComplete={autoComplete}
        />
    );
};
