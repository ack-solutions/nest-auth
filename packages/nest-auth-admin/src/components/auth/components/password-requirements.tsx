import React from 'react';
import { Box, Typography } from '@mui/material';

export const PasswordRequirements: React.FC = () => {
    return (
        <Box sx={{ p: 2, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main', borderRadius: 1 }}>
            <Typography variant="body2" fontWeight="600" color="info.dark" sx={{ mb: 1 }}>
                Password Requirements:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'body2', color: 'info.dark', '& li': { mb: 0.5 } }}>
                <li>Minimum 8 characters</li>
                <li>At least one uppercase letter (A-Z)</li>
                <li>At least one lowercase letter (a-z)</li>
                <li>At least one number (0-9)</li>
                <li>At least one special character (@$!%*?&)</li>
            </Box>
        </Box>
    );
};
