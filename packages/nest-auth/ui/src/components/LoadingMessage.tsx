import React from 'react';

interface LoadingMessageProps {
    message?: string;
}

export const LoadingMessage: React.FC<LoadingMessageProps> = ({
    message = 'Loading…'
}) => {
    return <p className="muted" role="status" aria-live="polite" aria-atomic="true">{message}</p>;
};
