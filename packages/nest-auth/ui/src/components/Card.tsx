import React from 'react';

export interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    onClick?: () => void;
    overflow?: boolean;
}

const paddingMap = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'md',
    onClick,
    overflow = false,
}) => {
    const baseClasses = 'bg-white rounded-lg shadow-sm border border-gray-200';
    const paddingClass = paddingMap[padding];
    const overflowClass = overflow ? 'overflow-hidden' : '';
    const clickClass = onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : '';

    const combinedClasses = `${baseClasses} ${paddingClass} ${overflowClass} ${clickClass} ${className}`.trim();

    return (
        <div className={combinedClasses} onClick={onClick}>
            {children}
        </div>
    );
};
