import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => handleClose(false)}
                >
                    <div className="absolute inset-0 bg-black bg-opacity-50" aria-hidden="true" />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 id="confirm-title" className="text-lg font-semibold text-gray-900 mb-2">
                            {options.title}
                        </h3>
                        <p className="text-sm text-gray-700 mb-6">{options.message}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleClose(false)}
                            >
                                {options.cancelText}
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleClose(true)}
                            >
                                {options.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
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
