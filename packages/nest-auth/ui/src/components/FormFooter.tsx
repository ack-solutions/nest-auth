import React from 'react';
import { Button } from './Button';

export interface FormFooterAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    icon?: React.ReactNode;
}

export interface FormFooterProps {
    actions: FormFooterAction[];
    className?: string;
}

/**
 * FormFooter component for consistent footer actions in forms
 */
export const FormFooter: React.FC<FormFooterProps> = ({ actions, className = '' }) => {
    return (
        <div className={`flex justify-end gap-2 ${className}`}>
            {actions.map((action, index) => (
                <Button
                    key={index}
                    variant={action.variant || 'primary'}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                >
                    {action.icon}
                    {action.label}
                </Button>
            ))}
        </div>
    );
};
