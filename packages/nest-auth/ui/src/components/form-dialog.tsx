import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import { ReactNode } from 'react';
import { FieldValues, FormProvider, SubmitErrorHandler, SubmitHandler, UseFormReturn } from 'react-hook-form';
import { DialogTitleBar } from './dialog-title';
import { DialogProps } from './dialog';

export interface FormDialogProps<T extends FieldValues = FieldValues> extends Omit<DialogProps, 'onError'> {
    /** React Hook Form context (methods from useForm) */
    formContext: UseFormReturn<T>;
    /** Called when form submits successfully */
    onSuccess?: SubmitHandler<T>;
    /** Optional validation error handler */
    onError?: SubmitErrorHandler<T>;
    /** Actions rendered in the footer (e.g. Cancel + Submit buttons). Fixed at bottom. */
    actions?: ReactNode;
    /** Form body. Only this area scrolls; title and actions stay fixed. */
    children: ReactNode;
}

/**
 * Dialog with an integrated form. Title and actions stay fixed; only the content area scrolls.
 * Pass formContext (from useForm) and onSuccess; render form fields as children.
 */
export function FormDialog<T extends FieldValues = FieldValues>({
    open,
    onClose,
    title,
    subTitle,
    icon,
    formContext,
    onSuccess,
    onError,
    actions,
    children,
    maxWidth = 'sm',
    fullWidth = true,
    slotProps,
    ...dialogProps
}: FormDialogProps<T>) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth={fullWidth}
            maxWidth={maxWidth}
            slotProps={{
                ...slotProps,
                paper: {
                    ...slotProps?.paper,
                    component: 'form',
                    onSubmit: formContext.handleSubmit(onSuccess, onError)
                }
            }}
            {...dialogProps}
        >
            <FormProvider {...formContext}>
                <DialogTitleBar
                    title={title}
                    subTitle={subTitle}
                    icon={icon}
                    onClose={onClose}
                />
                <DialogContent
                    sx={{
                        flex: 1,
                        overflow: 'auto',
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {children}
                </DialogContent>
                {actions != null ? (
                    <DialogActions sx={{ flexShrink: 0 }}>{actions}</DialogActions>
                ) : null}
            </FormProvider>
        </Dialog>
    );
}
