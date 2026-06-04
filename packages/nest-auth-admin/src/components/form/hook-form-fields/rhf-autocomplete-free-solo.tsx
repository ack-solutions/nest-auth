import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';

export interface RHFAutocompleteFreeSoloProps<T extends FieldValues> {
    name: FieldPath<T>;
    control: Control<T>;
    options: string[];
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
}

export function RHFAutocompleteFreeSolo<T extends FieldValues>({
    name,
    control,
    options,
    label,
    placeholder,
    disabled,
    id,
}: RHFAutocompleteFreeSoloProps<T>) {
    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState: { error } }) => (
                <Autocomplete
                    freeSolo
                    options={options}
                    disabled={disabled}
                    value={field.value ?? ''}
                    onChange={(_, newValue) => {
                        field.onChange(newValue ?? '');
                    }}
                    onInputChange={(_, newInputValue, reason) => {
                        if (reason === 'input' || reason === 'clear') {
                            field.onChange(newInputValue);
                        }
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            id={id}
                            label={label}
                            placeholder={placeholder}
                            error={!!error}
                            helperText={error?.message}
                            fullWidth
                        />
                    )}
                />
            )}
        />
    );
}
