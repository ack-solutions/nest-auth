import React, { useId } from 'react';

interface SelectProps {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
    allowEmpty?: boolean;
    id?: string;
    disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    label,
    required = false,
    allowEmpty = true,
    id: providedId,
    disabled = false,
}) => {
    const generatedId = useId();
    const id = providedId || generatedId;

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                disabled={disabled}
                className={`input-field appearance-none bg-white ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
                {allowEmpty && <option value="">{placeholder}</option>}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
};
