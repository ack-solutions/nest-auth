import React from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

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

const mapVariant = (v?: 'primary' | 'secondary' | 'danger') => {
    if (v === 'danger') return { variant: 'contained' as const, color: 'error' as const };
    if (v === 'secondary') return { variant: 'outlined' as const, color: 'inherit' as const };
    return { variant: 'contained' as const, color: 'primary' as const };
};

export const FormFooter: React.FC<FormFooterProps> = ({ actions, className }) => (
    <Stack className={className} direction="row" justifyContent="flex-end" spacing={1}>
        {actions.map((action, index) => (
            <Button
                key={index}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                {...mapVariant(action.variant)}
            >
                {action.icon}
                {action.label}
            </Button>
        ))}
    </Stack>
);
