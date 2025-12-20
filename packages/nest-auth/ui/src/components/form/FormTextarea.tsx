import React from 'react';
import { useFormContext, FieldError } from 'react-hook-form';

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    name: string;
    label?: string;
    helperText?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
    name,
    label,
    helperText,
    className = '',
    ...props
}) => {
    const { register, formState: { errors } } = useFormContext();
    const error = errors[name] as FieldError | undefined;

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {props.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <textarea
                id={name}
                {...register(name)}
                {...props}
                className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
            />
            {error?.message && (
                <p className="text-sm text-red-600 mt-1">{error.message}</p>
            )}
            {helperText && !error && (
                <p className="text-xs text-gray-500 mt-1">{helperText}</p>
            )}
        </div>
    );
};
