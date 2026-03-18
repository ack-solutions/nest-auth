import React from 'react';
import { Box, Typography } from '@mui/material';
import { Shield } from 'lucide-react';

export const LoginHeader: React.FC = () => {
    return (
        <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 64,
                    height: 64,
                    bgcolor: 'primary.main',
                    borderRadius: '50%',
                    mb: 2,
                    boxShadow: 2,
                }}
            >
                <Shield style={{ width: 32, height: 32, color: 'var(--mui-palette-primary-contrastText)' }} />
            </Box>
            <Typography variant="h4" fontWeight="bold" color="text.primary">
                Nest Auth
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Admin Dashboard
            </Typography>
        </Box>
    );
};
