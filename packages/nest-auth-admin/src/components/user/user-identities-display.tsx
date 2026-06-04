import React from 'react';
import { Hash, Key, Calendar, RefreshCcw } from 'lucide-react';
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
import type { UserIdentityInfo } from '../../types';

function formatDateTime(value?: string | Date): string {
    if (value == null || value === '') return '—';
    try {
        return new Date(value as string | number | Date).toLocaleString();
    } catch {
        return String(value);
    }
}

export interface UserIdentitiesDisplayProps {
    identities: UserIdentityInfo[];
}

export const UserIdentitiesDisplay: React.FC<UserIdentitiesDisplayProps> = ({ identities }) => {
    if (!identities?.length) {
        return (
            <Box sx={{ textAlign: 'center', py: 2, color: 'text.disabled' }}>
                <Typography variant="caption">No identities</Typography>
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
                                <Icon component={Key} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Provider
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                Provider ID
                            </Typography>
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
                                <Icon component={RefreshCcw} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                    Updated
                                </Typography>
                            </Box>
                        </TableCell>
                        <TableCell>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                ID
                            </Typography>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {identities.map((identity) => (
                        <TableRow key={identity.id} hover>
                            <TableCell >
                                <Typography variant="body2" fontWeight={600}>
                                    {identity.provider}
                                </Typography>
                            </TableCell>
                            <TableCell >
                                <Typography variant="body2" noWrap title={identity.providerId || ''}>
                                    {identity.providerId || '—'}
                                </Typography>
                            </TableCell>
                            <TableCell >
                                <Typography variant="body2">{formatDateTime(identity.createdAt)}</Typography>
                            </TableCell>
                            <TableCell >
                                <Typography variant="body2">{formatDateTime(identity.updatedAt)}</Typography>
                            </TableCell>
                            <TableCell >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Icon component={Hash} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    <Typography
                                        variant="caption"
                                        sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                                        noWrap
                                        title={identity.id}
                                    >
                                        {identity.id}
                                    </Typography>
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

