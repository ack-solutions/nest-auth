import { useForkRef } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import type { ReactNode } from 'react';
import { forwardRef, useCallback, useState } from 'react';
import {
    Control,
    FieldPath,
    FieldValues,
    useController,
    useFormContext,
    useWatch,
} from 'react-hook-form';

import { PasswordStrengthLinearMeter } from '../../auth/components/password-strength-indicator';
import { TextFieldRaw, TextFieldRawProps } from '../fields/text-field-raw';

export type RHFPasswordFieldProps = Omit<TextFieldRawProps, 'name' | 'type'> & {
    name: string;
    control?: Control;
    hideShowToggle?: boolean;
    showGenerateButton?: boolean;
    showStrengthIndicator?: boolean;
};

function generatePasswordValue(): string {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const special = '@$!%*?&';
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    const parts: string[] = [pick(lower), pick(upper), pick(digits), pick(special)];
    const all = lower + upper + digits + special;
    for (let i = 0; i < 12; i++) {
        parts.push(pick(all));
    }
    return parts.sort(() => Math.random() - 0.5).join('');
}

/**
 * Password field for react-hook-form: visibility toggle, optional generate + strength meter.
 * Keeps all password-specific behaviour separate from {@link RHFTextField}.
 */
export const RHFPasswordField = forwardRef<HTMLDivElement, RHFPasswordFieldProps>(
    (props, ref) => {
        const {
            name,
            control: controlProp,
            hideShowToggle = false,
            showGenerateButton = false,
            showStrengthIndicator = false,
            inputRef,
            onBlur,
            onChange,
            ...rest
        } = props;

        const ctx = useFormContext();
        const control = controlProp ?? ctx?.control;
        if (!control) {
            throw new Error(
                'RHFPasswordField: pass `control` or render inside FormProvider (e.g. FormContainer with formContext={methods}).',
            );
        }

        const [showPassword, setShowPassword] = useState(false);
        const { field, fieldState: { error } } = useController({ name, control });
        const watched = useWatch({
            control,
            name: name as FieldPath<FieldValues>,
        }) as string | undefined;

        const handleInputRef = useForkRef(field.ref, inputRef);

        const handleGenerate = useCallback(() => {
            field.onChange(generatePasswordValue());
        }, [field]);

        const inputSlot = rest.slotProps?.input;
        const priorEnd =
            inputSlot && typeof inputSlot === 'object' && 'endAdornment' in inputSlot
                ? (inputSlot as { endAdornment?: ReactNode }).endAdornment
                : undefined;
        const hasExtras = showGenerateButton || !hideShowToggle;
        const endAdornment =
            priorEnd || hasExtras ? (
                <InputAdornment position="end">
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            flexWrap: 'wrap',
                            justifyContent: 'flex-end',
                        }}
                    >
                        {priorEnd}
                        {showGenerateButton && (
                            <Button size="small" variant="text" type="button" onClick={handleGenerate}>
                                Generate
                            </Button>
                        )}
                        {!hideShowToggle && (
                            <IconButton
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                onClick={() => setShowPassword((s) => !s)}
                                edge="end"
                                size="small"
                            >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        )}
                    </Box>
                </InputAdornment>
            ) : undefined;

        return (
            <Box>
                <TextFieldRaw
                    {...rest}
                    name={field.name}
                    type={showPassword ? 'text' : 'password'}
                    value={field.value ?? ''}
                    onChange={(event) => {
                        field.onChange(event);
                        onChange?.(event);
                    }}
                    onBlur={(event) => {
                        field.onBlur();
                        onBlur?.(event);
                    }}
                    error={!!error}
                    helperText={error ? error.message : rest.helperText}
                    inputRef={handleInputRef}
                    fullWidth
                    ref={ref}
                    slotProps={{
                        ...rest.slotProps,
                        input: {
                            ...rest.slotProps?.input,
                            endAdornment,
                        },
                    }}
                />
                {showStrengthIndicator && !!watched && (
                    <PasswordStrengthLinearMeter password={watched} />
                )}
            </Box>
        );
    },
);
