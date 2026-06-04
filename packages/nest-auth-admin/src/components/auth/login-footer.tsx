import React from 'react';
import { Typography } from '@mui/material';

export const LoginFooter: React.FC = () => {
    return (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 3 }}>
            Powered by{' '}
            <Typography
                component="a"
                href="https://github.com/ack-solutions/packages"
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                sx={{ color: 'primary.main', fontWeight: 500, '&:hover': { color: 'primary.dark' } }}
            >
                @ackplus/nest-auth
            </Typography>
        </Typography>
    );
};
