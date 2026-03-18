import React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { RefreshCw } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    description: string;
    onRefresh?: () => void;
    loading?: boolean;
    action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    description,
    onRefresh,
    loading,
    action,
}) => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight="bold" color="text.primary">
                {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {description}
            </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1.5}>
            {onRefresh && (
                <Button variant="outlined" onClick={onRefresh} disabled={loading} color="inherit" startIcon={<RefreshCw style={{ width: 16, height: 16, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
            )}
            {action}
        </Stack>
    </Stack>
);
