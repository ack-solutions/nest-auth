import React, { useState } from 'react';
import { Key, Eye, EyeOff } from 'lucide-react';
import { IconButton } from '@mui/material';
import { FormField, FormFieldProps } from './form-field';

export interface SecretKeyFieldProps extends Omit<FormFieldProps, 'type' | 'startIcon'> {
    helpText?: string | React.ReactNode;
}

export const SecretKeyField: React.FC<SecretKeyFieldProps> = ({
    helpText,
    maxLength = 512,
    placeholder = 'your-nest-auth-secret-key',
    disabled,
    ...props
}) => {
    const [showSecretKey, setShowSecretKey] = useState(false);

    const endActions = (
        <IconButton
            size="small"
            onClick={() => setShowSecretKey(!showSecretKey)}
            title={showSecretKey ? 'Hide secret key' : 'Show secret key'}
            disabled={disabled}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
        >
            {showSecretKey ? (
                <EyeOff style={{ width: 20, height: 20 }} />
            ) : (
                <Eye style={{ width: 20, height: 20 }} />
            )}
        </IconButton>
    );

    return (
        <FormField
            {...props}
            disabled={disabled}
            type={showSecretKey ? 'text' : 'password'}
            startIcon={<Key style={{ width: 20, height: 20, color: 'var(--mui-palette-text-secondary)' }} />}
            endActions={endActions}
            maxLength={maxLength}
            placeholder={placeholder}
            helpText={helpText}
        />
    );
};
