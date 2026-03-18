import React from 'react';
import { Box, Typography } from '@mui/material';
import { calculatePasswordStrength } from '../utils/security';

interface PasswordStrengthIndicatorProps {
    password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
    if (!password || password.length === 0) {
        return null;
    }

    const strength = calculatePasswordStrength(password);

    if (!strength) {
        return null;
    }

    const strengthColors = {
        weak: 'error.main',
        medium: 'warning.main',
        strong: 'success.main',
    };

    const strengthLabels = {
        weak: 'Weak',
        medium: 'Medium',
        strong: 'Strong',
    };

    const width = strength === 'weak' ? '33%' : strength === 'medium' ? '66%' : '100%';

    return (
        <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box
                    sx={{
                        flex: 1,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        height: 8,
                        overflow: 'hidden',
                    }}
                >
                    <Box
                        sx={{
                            height: '100%',
                            width,
                            bgcolor: strengthColors[strength],
                            borderRadius: 1,
                            transition: 'width 0.2s',
                        }}
                    />
                </Box>
                <Typography variant="caption" fontWeight="medium" color={strengthColors[strength]}>
                    {strengthLabels[strength]}
                </Typography>
            </Box>
        </Box>
    );
};
