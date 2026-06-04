import React from 'react';
import { Typography } from '@mui/material';

interface LoadingMessageProps {
    message?: string;
}

export const LoadingMessage: React.FC<LoadingMessageProps> = ({
    message = 'Loading…'
}) => {
    return (
        <Typography variant="body2" color="text.secondary" role="status" aria-live="polite" aria-atomic="true">
            {message}
        </Typography>
    );
};
