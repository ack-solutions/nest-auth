import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface ToggleSwitchRowProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label: string;
    description?: string;
    icon?: ReactNode;
}

/** Label + optional description + optional icon on the left, MUI Switch on the right */
export function ToggleSwitchRow({
    checked,
    onChange,
    disabled = false,
    label,
    description,
    icon,
}: ToggleSwitchRowProps) {
    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            sx={{
                p: 1.5,
                bgcolor: 'grey.50',
                borderRadius: 1,
                '&:hover': { bgcolor: 'grey.100' },
            }}
        >
            <Stack direction="row" alignItems="center" spacing={1.5}>
                {icon && <Box sx={{ color: 'text.secondary' }}>{icon}</Box>}
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight="500">
                        {label}
                    </Typography>
                    {description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            {description}
                        </Typography>
                    )}
                </Stack>
            </Stack>
            <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} color="primary" />
        </Stack>
    );
}
