import React from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    tabs?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    showCloseButton?: boolean;
    animate?: boolean;
}

const maxWidthMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
};

export const ModalFooter = ({ footer, className }: { footer: React.ReactNode; className?: string }) => {
    return (
        <div className={`p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 ${className}`}>
            {footer}
        </div>
    );
};
export const ModalContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    return (
        <div className={`flex-1 overflow-y-auto px-4 ${className}`}>
            {children}
        </div>
    );
};

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    icon,
    children,
    footer,
    tabs,
    maxWidth = 'md',
    showCloseButton = true,
    animate = false,
}) => {
    if (!isOpen) return null;

    const wrapperClasses = animate
        ? "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
        : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";

    const contentClasses = animate
        ? `bg-white rounded-xl shadow-2xl ${maxWidthMap[maxWidth]} w-full h-[90vh] overflow-hidden animate-slide-up flex flex-col`
        : `bg-white rounded-xl shadow-2xl ${maxWidthMap[maxWidth]} w-full h-[90vh] flex flex-col`;

    return (
        <div className={wrapperClasses}>
            {/* Header - Fixed */}
            <div className={contentClasses}>
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100 flex items-center justify-between flex-shrink-0">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            {icon && icon}
                            {title}
                        </h3>
                        {description && (
                            <p className="text-xs text-gray-600 mt-0.5">
                                {description}
                            </p>
                        )}
                    </div>
                    {showCloseButton && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Sticky Tabs */}
                {tabs && (
                    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 flex-shrink-0">
                        {tabs}
                    </div>
                )}

                {/* Content - Scrollable */}
                <ModalContent className={`${!footer ? 'pb-4' : ''} ${tabs ? 'pt-4' : ''}`}>
                    {children}
                </ModalContent>

                {/* Footer - Fixed */}
                {footer && (
                    <ModalFooter footer={footer} />
                )}
            </div>
        </div>
    );
};
