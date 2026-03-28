import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import {
    getPasswordStrengthCategory,
    getPasswordStrengthLabel,
    getPasswordStrengthScore,
} from '../utils/security';

interface PasswordStrengthIndicatorProps {
    password: string;
}

const strengthColors = {
    weak: 'error.main',
    medium: 'warning.main',
    strong: 'success.main',
} as const;

/** Compact segmented bar + label (e.g. signup forms). Uses the same score as {@link PasswordStrengthLinearMeter}. */
export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
    if (!password || password.length === 0) {
        return null;
    }

    const score = getPasswordStrengthScore(password);
    const strength = getPasswordStrengthCategory(score);
    const width = `${score}%`;

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
                    {getPasswordStrengthLabel(score)}
                </Typography>
            </Box>
        </Box>
    );
};

interface PasswordStrengthLinearMeterProps {
    password: string;
}

/** MUI `LinearProgress` + caption (e.g. RHF password field, edit-password modal). */
export const PasswordStrengthLinearMeter: React.FC<PasswordStrengthLinearMeterProps> = ({ password }) => {
    if (!password) {
        return null;
    }

    const score = getPasswordStrengthScore(password);
    const category = getPasswordStrengthCategory(score);
    const color = category === 'weak' ? 'error' : category === 'medium' ? 'warning' : 'success';

    return (
        <Box sx={{ mt: 1 }}>
            <LinearProgress
                variant="determinate"
                value={score}
                color={color}
                sx={{ height: 6, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {getPasswordStrengthLabel(score)}
            </Typography>
        </Box>
    );
};
