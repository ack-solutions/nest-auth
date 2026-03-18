import React from 'react';
import { Modal } from './modal';
import { FormFooter, FormFooterAction } from './form-footer';

export interface FormDialogProps {
    open?: boolean;
    isOpen?: boolean;
    onClose: () => void;
    title: string;
    subTitle?: string;
    description?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    actions: FormFooterAction[];
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const FormDialog: React.FC<FormDialogProps> = ({
    open: openProp,
    isOpen,
    onClose,
    title,
    subTitle,
    description,
    icon,
    children,
    actions,
    maxWidth = 'sm',
}) => {
    const open = openProp ?? isOpen ?? false;
    const mw = maxWidth === '2xl' ? 'xl' : maxWidth;
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            subTitle={subTitle ?? description}
            icon={icon}
            maxWidth={mw}
            footer={<FormFooter actions={actions} />}
        >
            {children}
        </Modal>
    );
};
