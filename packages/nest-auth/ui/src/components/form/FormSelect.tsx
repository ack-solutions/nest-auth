import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';

interface FormSelectProps {
    name: string;
    label?: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    helperText?: string;
    required?: boolean;
    allowEmpty?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
    name,
    label,
    options,
    placeholder = 'Select an option...',
    helperText,
    required = false,
    allowEmpty = true,
}) => {
    const { control, formState: { errors } } = useFormContext();
    const error = errors[name];

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <select
                        {...field}
                        id={name}
                        className={`input-field appearance-none bg-white cursor-pointer ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                    >
                        {allowEmpty && <option value="">{placeholder}</option>}
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                )}
            />
            {error && (
                <p className="text-sm text-red-600 mt-1">{error.message as string}</p>
            )}
            {helperText && !error && (
                <p className="text-xs text-gray-500 mt-1">{helperText}</p>
            )}
        </div>
    );
};
