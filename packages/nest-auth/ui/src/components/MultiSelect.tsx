import React, { useState, useRef, useEffect, useId } from 'react';
import { X, ChevronDown } from 'lucide-react';

interface MultiSelectProps {
    options: Array<{ value: string; label: string }>;
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    label?: string;
    name?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select options...',
    label,
    name,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const generatedId = useId();
    const id = name || generatedId;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = (optionValue: string) => {
        if (value.includes(optionValue)) {
            onChange(value.filter((v) => v !== optionValue));
        } else {
            onChange([...value, optionValue]);
        }
    };

    const handleRemove = (optionValue: string) => {
        onChange(value.filter((v) => v !== optionValue));
    };

    const getLabel = (val: string) => {
        return options.find((opt) => opt.value === val)?.label || val;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        }
    };

    const handleRemoveKeyDown = (val: string, e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRemove(val);
        }
    };

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}
            <div className="relative" ref={wrapperRef}>
                <div
                    id={id}
                    role="button"
                    tabIndex={0}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    className="input-field cursor-pointer flex items-center justify-between min-h-[42px]"
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={handleKeyDown}
                >
                    <div className="flex flex-wrap gap-1 flex-1">
                        {value.length === 0 ? (
                            <span className="text-gray-400">{placeholder}</span>
                        ) : (
                            value.map((val) => (
                                <span
                                    key={val}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Remove ${getLabel(val)}`}
                                    className="badge-info flex items-center gap-1 px-2 py-1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(val);
                                    }}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        handleRemoveKeyDown(val, e);
                                    }}
                                >
                                    {getLabel(val)}
                                    <X className="w-3 h-3 cursor-pointer hover:text-blue-900" />
                                </span>
                            ))
                        )}
                    </div>
                    <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
                    />
                </div>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {options.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500">No options available</div>
                        ) : (
                            options.map((option) => {
                                const isSelected = value.includes(option.value);
                                return (
                                    <div
                                        key={option.value}
                                        className={`px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                                            }`}
                                        onClick={() => handleToggle(option.value)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{option.label}</span>
                                            {isSelected && (
                                                <span className="text-primary-600">✓</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
