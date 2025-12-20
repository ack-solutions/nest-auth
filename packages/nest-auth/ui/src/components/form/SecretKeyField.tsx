import React, { useState } from 'react';
import { Key, Eye, EyeOff } from 'lucide-react';
import { FormField, FormFieldProps } from './FormField';

export interface SecretKeyFieldProps extends Omit<FormFieldProps, 'type' | 'startIcon'> {
    helpText?: string | React.ReactNode;
}

/**
 * Secret key field wrapper - uses FormField with password type and Key icon
 * All rendering logic is in FormField (single source of truth)
 */

export const SecretKeyField: React.FC<SecretKeyFieldProps> = ({
    helpText,
    maxLength = 512,
    placeholder = 'your-nest-auth-secret-key',
    ...props
}) => {
    const [showSecretKey, setShowSecretKey] = useState(false);

    const endActions = (
        <button
            type="button"
            onClick={() => setShowSecretKey(!showSecretKey)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title={showSecretKey ? 'Hide secret key' : 'Show secret key'}
            disabled={props.disabled}
        >
            {showSecretKey ? (
                <EyeOff className="h-5 w-5 text-gray-400 hover:text-primary-600 transition-colors" />
            ) : (
                <Eye className="h-5 w-5 text-gray-400 hover:text-primary-600 transition-colors" />
            )}
        </button>
    );

    return (
        <FormField
            {...props}
            type={showSecretKey ? 'text' : 'password'}
            startIcon={Key}
            endActions={endActions}
            maxLength={maxLength}
            placeholder={placeholder}
            helpText={helpText}
        />
    );
};
