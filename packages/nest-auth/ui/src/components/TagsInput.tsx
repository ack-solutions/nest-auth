import React, { useState, KeyboardEvent, useId } from 'react';
import { X, Plus } from 'lucide-react';

interface TagsInputProps {
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    label?: string;
    helperText?: string;
    id?: string;
}

export const TagsInput: React.FC<TagsInputProps> = ({
    value,
    onChange,
    placeholder = 'Type and press Enter...',
    label,
    helperText,
    id: providedId,
}) => {
    const [inputValue, setInputValue] = useState('');
    const generatedId = useId();
    const id = providedId || generatedId;

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
            // Remove last tag on backspace if input is empty
            removeTag(value[value.length - 1]);
        }
    };

    const addTag = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed]);
            setInputValue('');
        }
    };

    const removeTag = (tag: string) => {
        onChange(value.filter((t) => t !== tag));
    };

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}
            <div className="input-field p-2 flex flex-wrap gap-2 items-center min-h-[42px]">
                {value.map((tag) => (
                    <span
                        key={tag}
                        className="badge-info flex items-center gap-1 px-2 py-1"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-blue-900 focus:outline-none"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                    <input
                        id={id}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={value.length === 0 ? placeholder : ''}
                        className="flex-1 outline-none border-none focus:ring-0 p-0 min-w-0"
                    />
                    {inputValue.trim() && (
                        <button
                            type="button"
                            onClick={addTag}
                            className="text-primary-600 hover:text-primary-700 focus:outline-none"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            {helperText && (
                <p className="text-xs text-gray-500 mt-1">{helperText}</p>
            )}
        </div>
    );
};
