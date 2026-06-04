import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { AsyncAutocomplete, AsyncAutocompleteProps } from '../fields/async-autocomplete';

export interface RHFAsyncAutocompleteProps extends Omit<AsyncAutocompleteProps, 'value' | 'onChange'> {
    name: string;
    onChange?: (newValue?: any, fullValue?: any) => void;
}

export function RHFAsyncAutocomplete({
    name,
    onChange,
    ...other
}: RHFAsyncAutocompleteProps) {
    const { control, setValue } = useFormContext();

    const handleChange = useCallback(
        (newValue: any, fullValue: any) => {
            setValue(name, newValue, { shouldValidate: true });
            onChange?.(newValue, fullValue);
        },
        [name, onChange, setValue],
    );

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <AsyncAutocomplete
                    {...field}
                    value={field.value}
                    onChange={handleChange}
                    error={error}
                    {...other}
                />
            )}
        />
    );
}
