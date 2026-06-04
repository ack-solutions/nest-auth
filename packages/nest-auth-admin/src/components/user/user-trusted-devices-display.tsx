import React from 'react';
import { Shield, Globe, Calendar, Clock, Timer, Hash } from 'lucide-react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Icon } from '@mui/material';
import type { TrustedDeviceInfo } from '../../types';

function formatDateTime(value?: string | Date | null): string {
    if (value == null || value === '') return '—';
    try {
        return new Date(value as string | number | Date).toLocaleString();
    } catch {
        return String(value);
    }
}

function statusForDevice(device: TrustedDeviceInfo): 'revoked' | 'expired' | 'active' {
    if (device.revokedAt) return 'revoked';
    try {
        return new Date(device.expiresAt as string | number | Date).getTime() <= Date.now() ? 'expired' : 'active';
    } catch {
        return 'active';
    }
}

export interface UserTrustedDevicesDisplayProps {
    trustedDevices: TrustedDeviceInfo[];
}

export const UserTrustedDevicesDisplay: React.FC<UserTrustedDevicesDisplayProps> = ({ trustedDevices }) => {
    if (!trustedDevices?.length) {
        return (
            <Box sx={{ textAlign: 'center', py: 2, color: 'text.disabled' }}>
                <Typography variant="caption">No trusted devices</Typography>
            </Box>
        );
    }

    return (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
            <Table size="small" >
                <TableHead>
                    <TableRow>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Icon component={Shield} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Device (user agent)
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Icon component={Globe} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    IP
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Icon component={Calendar} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Created
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Icon component={Clock} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Last used
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Icon component={Timer} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Expires
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                Status
                            </Typography>
                        </TableCell>
                        <TableCell>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                ID
                            </Typography>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {trustedDevices.map((device) => {
                        const status = statusForDevice(device);
                        const statusSx =
                            status === 'active'
                                ? { bgcolor: 'success.50', color: 'success.dark', borderColor: 'success.200' }
                                : status === 'expired'
                                    ? { bgcolor: 'warning.50', color: 'warning.dark', borderColor: 'warning.200' }
                                    : { bgcolor: 'error.50', color: 'error.dark', borderColor: 'error.200' };

                        return (
                            <TableRow key={device.id} hover>
                                <TableCell >
                                    <Typography variant="body2" noWrap title={device.userAgent || ''}>
                                        {device.userAgent || '—'}
                                    </Typography>
                                </TableCell>
                                <TableCell >
                                    <Typography variant="body2">{device.ipAddress || '—'}</Typography>
                                </TableCell>
                                <TableCell >
                                    <Typography variant="body2">{formatDateTime(device.createdAt)}</Typography>
                                </TableCell>
                                <TableCell >
                                    <Typography variant="body2">{formatDateTime(device.lastUsedAt)}</Typography>
                                </TableCell>
                                <TableCell >
                                    <Typography variant="body2">{formatDateTime(device.expiresAt)}</Typography>
                                </TableCell>
                                <TableCell >
                                    <Box
                                        component="span"
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            px: 1,
                                            py: 0.25,
                                            borderRadius: '9999px',
                                            typography: 'caption',
                                            fontWeight: 700,
                                            border: '1px solid',
                                            ...statusSx,
                                        }}
                                    >
                                        {status}
                                    </Box>
                                </TableCell>
                                <TableCell >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Icon component={Hash} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        <Typography
                                            variant="caption"
                                            sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                                            noWrap
                                            title={device.id}
                                        >
                                            {device.id}
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

