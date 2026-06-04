import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

type ConfirmOptions = {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
};

type OpenConfirm = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<OpenConfirm | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<(value: boolean) => void>();

    const openConfirm: OpenConfirm = useCallback((opts) => {
        if (open || resolverRef.current) {
            return Promise.reject(new Error('A confirmation dialog is already open.'));
        }
        const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
        setOptions({
            title: normalized.title ?? 'Confirm action',
            message: normalized.message,
            confirmText: normalized.confirmText ?? 'Confirm',
            cancelText: normalized.cancelText ?? 'Cancel',
        });
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    }, [open]);

    const handleClose = useCallback((result: boolean) => {
        setOpen(false);
        const resolver = resolverRef.current;
        resolverRef.current = undefined;
        if (resolver) resolver(result);
    }, []);

    const ctxValue = useMemo(() => openConfirm, [openConfirm]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, handleClose]);

    return (
        <ConfirmContext.Provider value={ctxValue}>
            {children}
            {open && options && (
                <Dialog open={true} onClose={() => handleClose(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
                    <DialogTitle id="confirm-title">{options.title}</DialogTitle>
                    <DialogContent>
                        {options.message}
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button variant="outlined" onClick={() => handleClose(false)}>
                            {options.cancelText}
                        </Button>
                        <Button variant="contained" color="primary" onClick={() => handleClose(true)}>
                            {options.confirmText}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = (): OpenConfirm => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return ctx;
};
