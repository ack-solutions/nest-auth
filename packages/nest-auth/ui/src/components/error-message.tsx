import React from 'react';
import { Typography } from '@mui/material';

interface ErrorMessageProps {
    message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    if (!message) return null;

    return (
        <Typography variant="body2" color="error" aria-live="polite">
            {message}
        </Typography>
    );
};
