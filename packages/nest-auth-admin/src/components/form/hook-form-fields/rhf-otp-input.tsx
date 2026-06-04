import { FormHelperText, useTheme } from '@mui/material';
import { Control, useController } from 'react-hook-form';

import { useResponsive } from '../../hook';
import OTPInput, { OTPInputProps } from '../fields/otp-input';


export interface RHFOtpInputProps
    extends Omit<OTPInputProps, 'onChange' | 'renderInput'> {
    name: string;
    control?: Control;
    inputStyleProps?: any
}

export function RHFOtpInput({ name, control, inputStyleProps, ...props }: RHFOtpInputProps) {
    const isMobile = useResponsive('down', 'sm');
    const theme = useTheme();
    const {
        field,
        fieldState: { error },
    } = useController({
        name,
        control,
    });

    return (
        <>
            <OTPInput
                containerStyle={{
                    margin: '0 auto',
                    gap: theme.spacing(1),
                }}
                inputStyle={{
                    padding: theme.spacing(1.5),
                    width: isMobile ? 38 : 48,
                    height: isMobile ? 38 : 48,
                    border: '2px solid',
                    borderRadius: theme.shape.borderRadius,
                    background: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontSize: theme.typography.h6.fontSize,
                    fontWeight: theme.typography.fontWeightBold,
                    textAlign: 'center',
                    outline: 'none',
                    transition: theme.transitions.create(['border-color', 'box-shadow']),
                    ...theme.typography.body1,
                    ...(error?.message ?
                        {
                            borderColor: theme.palette.error.main,
                        } :
                        {
                            borderColor: theme.palette.grey[400],
                        }),
                    ...inputStyleProps,
                }}
                onChange={field.onChange}
                value={field.value}
                inputType="number"
                renderInput={(props) => (
                    <input
                        {...props}
                        style={{
                            ...props.style,
                            color: theme.palette.text.primary,
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = error?.message
                                ? theme.palette.error.main
                                : theme.palette.primary.main;
                            e.target.style.boxShadow = `0 0 0 3px ${error?.message
                                ? theme.palette.error.main
                                : theme.palette.primary.main}20`;
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = error?.message
                                ? theme.palette.error.main
                                : theme.palette.grey[400];
                            e.target.style.boxShadow = 'none';
                            props.onBlur?.(e);
                        }}
                    />
                )}
                shouldAutoFocus
                {...props}
            />
            {error?.message ? (
                <FormHelperText
                    error
                    sx={{ ml: 1.5 }}
                >
                    {' '}
                    {error?.message}
                    {' '}
                </FormHelperText>
            ) : null}
        </>
    );
}
