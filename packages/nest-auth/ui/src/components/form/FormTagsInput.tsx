import React from 'react';
import { useFormContext, Controller, FieldError } from 'react-hook-form';
import { TagsInput } from '../TagsInput';

interface FormTagsInputProps {
    name: string;
    label?: string;
    placeholder?: string;
    helperText?: string;
}

export const FormTagsInput: React.FC<FormTagsInputProps> = ({
    name,
    label,
    placeholder = 'Type and press Enter...',
    helperText,
}) => {
    const { control, formState: { errors } } = useFormContext();
    const error = errors[name] as FieldError | undefined;
    const errorString = typeof error?.message === 'string' ? error.message : null;

    return (
        <div className="w-full">
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <TagsInput
                        label={label}
                        value={field.value || []}
                        onChange={field.onChange}
                        placeholder={placeholder}
                        helperText={helperText && !errorString ? helperText : undefined}
                    />
                )}
            />
            {errorString && (
                <p className="text-sm text-red-600 mt-1">{errorString}</p>
            )}
        </div>
    );
};
