import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PasswordStrengthIndicator } from '../auth/components/password-strength-indicator';
import { generateRandomPassword } from '../auth/utils/security';
import { FormField, FormFieldProps } from './form-field';

export interface PasswordFieldProps extends Omit<FormFieldProps, 'type'> {
    showGenerateButton?: boolean;
    showStrengthIndicator?: boolean;
    onGeneratePassword?: (password: string) => void;
    startIcon?: React.ReactNode;
    hideShowToggle?: boolean;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
    showGenerateButton = false,
    showStrengthIndicator = false,
    onGeneratePassword,
    startIcon = <LockIcon fontSize="small" color="action" />,
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
                <IconButton
                    size="small"
                    onClick={handleGeneratePassword}
                    title="Generate random password"
                    disabled={props.disabled}
                >
                    <RefreshIcon fontSize="small" />
                </IconButton>
            )}
            {!hideShowToggle && (
                <IconButton
                    size="small"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    disabled={props.disabled}
                >
                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
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
