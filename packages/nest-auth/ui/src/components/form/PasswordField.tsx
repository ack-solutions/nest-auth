import React, { useState } from 'react';
import { Lock, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { PasswordStrengthIndicator } from '../auth/components/PasswordStrengthIndicator';
import { generateRandomPassword } from '../auth/utils/security';
import { FormField, FormFieldProps } from './FormField';

export interface PasswordFieldProps extends Omit<FormFieldProps, 'type'> {
    showGenerateButton?: boolean;
    showStrengthIndicator?: boolean;
    onGeneratePassword?: (password: string) => void;
    startIcon?: React.ReactNode;
    hideShowToggle?: boolean;
}

/**
 * Password field wrapper - uses FormField with password type and optional features
 * All rendering logic is in FormField (single source of truth)
 */

export const PasswordField: React.FC<PasswordFieldProps> = ({
    showGenerateButton = false,
    showStrengthIndicator = false,
    onGeneratePassword,
    startIcon = <Lock className="h-5 w-5 text-gray-400" />,
    hideShowToggle = false,
    placeholder = '••••••••',
    autoComplete = 'new-password',
    maxLength = 128,
    required = true,
    ...props
}) => {
    const [showPassword, setShowPassword] = useState(false);

    const handleGeneratePassword = () => {
        const newPassword = generateRandomPassword(16);
        const passwordEvent = {
            target: { value: newPassword },
        } as React.ChangeEvent<HTMLInputElement>;

        if (onGeneratePassword) {
            onGeneratePassword(newPassword);
        } else {
            props.onChange(passwordEvent);
        }
    };

    const endActions = (
        <>
            {showGenerateButton && (
                <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Generate random password"
                    disabled={props.disabled}
                >
                    <RefreshCw className="h-5 w-5 text-gray-400 hover:text-primary-600 transition-colors" />
                </button>
            )}
            {!hideShowToggle && (
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    disabled={props.disabled}
                >
                    {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-primary-600 transition-colors" />
                    ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-primary-600 transition-colors" />
                    )}
                </button>
            )}
        </>
    );

    return (
        <>
            <FormField
                {...props}
                type={showPassword ? 'text' : 'password'}
                startIcon={startIcon}
                endActions={endActions}
                placeholder={placeholder}
                autoComplete={autoComplete}
                maxLength={maxLength}
                required={required}
            />
            {showStrengthIndicator && <PasswordStrengthIndicator password={props.value} />}
        </>
    );
};
