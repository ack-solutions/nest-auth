import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { MultiSelect } from '../MultiSelect';

interface FormMultiSelectProps {
    name: string;
    label?: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    helperText?: string;
}

export const FormMultiSelect: React.FC<FormMultiSelectProps> = ({
    name,
    label,
    options,
    placeholder = 'Select options...',
    helperText,
}) => {
    const { control, formState: { errors } } = useFormContext();
    const error = errors[name];

    return (
        <div className="w-full">
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <MultiSelect
                        label={label}
                        value={field.value || []}
                        onChange={field.onChange}
                        options={options}
                        placeholder={placeholder}
                    />
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
