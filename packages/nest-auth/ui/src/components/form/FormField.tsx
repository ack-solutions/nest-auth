import React, { ReactNode, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

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
    startIcon?: LucideIcon | ReactNode;
    endActions?: ReactNode;
    helpText?: string | ReactNode;
    inputClassName?: string;
}

/**
 * Standard form field component - single source of truth for all form inputs
 * Use this component directly or use specialized wrappers (EmailField, PasswordField, etc.)
 */
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
    className = '',
    startIcon: StartIcon,
    endActions,
    helpText,
    inputClassName = '',
}, ref) => {
    const hasStartIcon = !!StartIcon;
    const hasEndActions = !!endActions;
    const paddingLeft = hasStartIcon ? 'pl-10' : 'pl-3';
    const paddingRight = hasEndActions ? 'pr-20' : 'pr-3';

    return (
        <div className={className}>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
                {label}
            </label>
            <div className="relative">
                {hasStartIcon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        {React.isValidElement(StartIcon) ? (
                            StartIcon
                        ) : StartIcon && typeof StartIcon === 'function' ? (
                            React.createElement(StartIcon as React.ComponentType<any>, {
                                className: 'h-5 w-5 text-gray-400',
                                size: 20,
                                'aria-hidden': true
                            })
                        ) : null}
                    </div>
                )}
                <input
                    ref={ref}
                    id={id}
                    type={type}
                    required={required}
                    autoComplete={autoComplete}
                    maxLength={maxLength}
                    minLength={minLength}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    className={`input-field ${paddingLeft} ${paddingRight} ${error ? 'border-red-300' : ''} ${inputClassName}`}
                    placeholder={placeholder}
                    disabled={disabled}
                />
                {hasEndActions && (
                    <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                        {endActions}
                    </div>
                )}
            </div>
            {helpText && !error && (
                <div className="mt-1 text-xs text-gray-500">{helpText}</div>
            )}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
});

FormField.displayName = 'FormField';
