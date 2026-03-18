import React from 'react';
import { Building2, Shield, Trash2 } from 'lucide-react';
import Icon from '@mui/material/Icon';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import type { UserAccess, Role } from '../../types';

const tooltipSlotProps = { popper: { sx: { '& .MuiTooltip-tooltip': { typography: 'caption' } } } };

export interface UserTenantCardProps {
    access: UserAccess;
    rolesForTenant: Role[];
    tenantMode: 'isolated' | 'shared' | null;
    onEditRoles: () => void;
    onRemove?: () => void;
    loading?: boolean;
}

export const UserTenantCard: React.FC<UserTenantCardProps> = ({
    access,
    rolesForTenant,
    tenantMode,
    onEditRoles,
    onRemove,
    loading,
}) => {
    const tenant = access.tenant;
    const roleList = access.roles ?? [];
    const roleNames = roleList.map((r: any) => (typeof r === 'string' ? r : r.name));
    const canRemove = tenantMode === 'shared' && !!onRemove;

    return (
        <Box
            sx={{
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.50',
                '&:hover': { bgcolor: 'grey.100' },
            }}
        >
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                        <Icon component={Building2} sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" fontWeight={600}>
                            {tenant?.name ?? tenant?.slug ?? access.tenantId}
                        </Typography>
                    </Stack>
                    {roleNames.length > 0 ? (
                        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5}>
                            {roleNames.map((name) => (
                                <Chip
                                    key={name}
                                    size="small"
                                    label={name}
                                    sx={{
                                        bgcolor: 'primary.50',
                                        color: 'primary.700',
                                        border: '1px solid',
                                        borderColor: 'primary.200',
                                        fontSize: '0.75rem',
                                    }}
                                />
                            ))}
                        </Stack>
                    ) : (
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                            No roles
                        </Typography>
                    )}
                </Box>
                <Stack direction="row" spacing={0.5} flexShrink={0}>
                    <Tooltip title="Edit roles for this tenant" slotProps={tooltipSlotProps}>
                        <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={onEditRoles}
                            disabled={loading}
                            startIcon={<Icon component={Shield} />}
                            sx={{ minWidth: 0, py: 0.25 }}
                        >
                            Roles
                        </Button>
                    </Tooltip>
                    {canRemove && (
                        <Tooltip title="Remove user from this tenant" slotProps={tooltipSlotProps}>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={onRemove}
                                disabled={loading}
                                aria-label="Remove from tenant"
                            >
                                <Icon component={Trash2} sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
            </Stack>
        </Box>
    );
};
