import React from 'react';
import { Modal } from './Modal';
import { FormFooter, FormFooterAction } from './FormFooter';

export interface FormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    actions: FormFooterAction[];
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    showCloseButton?: boolean;
}

/**
 * Simplified FormDialog component that manages footer actions directly
 * No need for onFooterReady callbacks - just pass actions
 *
 * Usage:
 * ```tsx
 * <FormDialog
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="Create User"
 *   actions={[
 *     { label: 'Cancel', onClick: onClose, variant: 'secondary' },
 *     { label: 'Save', onClick: handleSubmit, variant: 'primary', disabled: isSubmitting }
 *   ]}
 * >
 *   <UserForm ... />
 * </FormDialog>
 * ```
 */
export const FormDialog: React.FC<FormDialogProps> = ({
    isOpen,
    onClose,
    title,
    description,
    icon,
    children,
    actions,
    maxWidth = 'md',
    showCloseButton = true,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            description={description}
            icon={icon}
            maxWidth={maxWidth}
            showCloseButton={showCloseButton}
            footer={<FormFooter actions={actions} />}
        >
            {children}
        </Modal>
    );
};
