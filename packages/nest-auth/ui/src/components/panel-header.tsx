import React from 'react';
import { Stack, Typography, Button } from '@mui/material';

interface PanelHeaderProps {
    title: string;
    description: string;
    onRefresh: () => void;
    loading?: boolean;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
    title,
    description,
    onRefresh,
    loading = false,
}) => {
    return (
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} useFlexGap flexWrap="wrap">
            <Stack spacing={0.25}>
                <Typography variant="h6" component="h2">{title}</Typography>
                <Typography variant="body2" color="text.secondary">{description}</Typography>
            </Stack>
            <Button variant="outlined" color="inherit" onClick={onRefresh} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
        </Stack>
    );
};
