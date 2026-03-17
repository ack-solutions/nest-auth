import { useRef, useState, useEffect, useCallback } from 'react';

export interface FormFooterHandle {
    getFooter: () => React.ReactNode | null;
}

/**
 * Hook that provides a ref and footer state.
 * Forms expose their footer via the ref using useImperativeHandle.
 * The hook automatically updates the footer state when the form state changes.
 *
 * Usage in Dialog:
 * ```tsx
 * const { formRef, footer } = useFormFooter();
 * return <Modal footer={footer}><Form ref={formRef} /></Modal>;
 * ```
 *
 * Usage in Form:
 * ```tsx
 * const Form = forwardRef<FormFooterHandle, Props>((props, ref) => {
 *   useImperativeHandle(ref, () => ({
 *     getFooter: () => <FooterButtons />
 *   }), [dependencies]);
 * });
 * ```
 */
export function useFormFooter() {
    const [footer, setFooter] = useState<React.ReactNode>(null);
    const formRef = useRef<FormFooterHandle>(null);

    // Update footer whenever this component re-renders (which happens when form state changes)
    // This works because React Hook Form triggers re-renders on state changes, and
    // useImperativeHandle will return the updated footer based on its dependencies
    useEffect(() => {
        if (formRef.current) {
            const newFooter = formRef.current.getFooter();
            setFooter(newFooter);
        }
    });

    return { formRef, footer };
}
