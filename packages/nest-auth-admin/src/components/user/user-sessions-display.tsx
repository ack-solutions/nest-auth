import React from 'react';
import { Lock, Trash2, AlertCircle, Globe, Calendar, Clock, Timer, Hash, User as UserIdIcon } from 'lucide-react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Icon } from '@mui/material';
import type { UserSessionInfo } from '../../types';

const tooltipSlotProps = { popper: { sx: { '& .MuiTooltip-tooltip': { typography: 'caption' } } } };

function formatDateTime(value?: string | Date): string {
    if (value == null || value === '') return '—';
    try {
        return new Date(value as string | number | Date).toLocaleString();
    } catch {
        return String(value);
    }
}

function sessionExpiryStatus(expiresAt?: string | Date): 'expired' | 'ok' | 'unknown' {
    if (expiresAt == null || expiresAt === '') return 'unknown';
    try {
        return new Date(expiresAt as string | number | Date).getTime() <= Date.now() ? 'expired' : 'ok';
    } catch {
        return 'unknown';
    }
}

export interface UserSessionsDisplayProps {
    sessions: UserSessionInfo[];
    sessionError?: string;
    onRevokeSession?: (sessionId: string) => void;
    sessionActionId?: string | null;
}

export const UserSessionsDisplay: React.FC<UserSessionsDisplayProps> = ({
    sessions,
    sessionError,
    onRevokeSession,
    sessionActionId,
}) => {
    return (
        <>
            {sessionError && (
                <Box
                    sx={{
                        bgcolor: 'error.light',
                        border: '1px solid',
                        borderColor: 'error.main',
                        color: 'error.dark',
                        typography: 'caption',
                        px: 1.5,
                        py: 1,
                        borderRadius: 1,
                        mb: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    <Icon component={AlertCircle} sx={{ fontSize: 14 }} />
                    {sessionError}
                </Box>
            )}

            {sessions.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TableContainer
                        component={Paper}
                        variant="outlined"
                        sx={{ overflowX: 'auto' }}
                    >
                        <Table size="small" sx={{ minWidth: 900 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <Icon component={Lock} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                Device
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
                                                Last active
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
                                            IDs
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                            Actions
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sessions.map((session) => {
                                    const expiry = sessionExpiryStatus(session.expiresAt);
                                    const expirySx =
                                        expiry === 'expired'
                                            ? { color: 'error.main' }
                                            : expiry === 'ok'
                                                ? { color: 'text.primary' }
                                                : { color: 'text.secondary' };

                                    return (
                                        <TableRow key={session.id} hover>
                                            <TableCell >
                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                    {session.deviceName || 'Unknown'}
                                                </Typography>
                                                {session.userAgent && (
                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                        {session.userAgent}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell >
                                                <Typography variant="body2">{session.ipAddress || '—'}</Typography>
                                            </TableCell>
                                            <TableCell >
                                                <Typography variant="body2">{formatDateTime(session.createdAt)}</Typography>
                                            </TableCell>
                                            <TableCell >
                                                <Typography variant="body2">{formatDateTime(session.lastActive)}</Typography>
                                            </TableCell>
                                            <TableCell >
                                                <Typography variant="body2" sx={expirySx}>
                                                    {formatDateTime(session.expiresAt)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell >
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                        <Icon component={Hash} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                                                            noWrap
                                                            title={session.id}
                                                        >
                                                            {session.id}
                                                        </Typography>
                                                    </Box>
                                                    {session.userId && (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                            <Icon component={UserIdIcon} sx={{ fontSize: 14, color: 'text.secondary' }} />
                                                            <Typography
                                                                variant="caption"
                                                                sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                                                                noWrap
                                                                title={session.userId}
                                                            >
                                                                {session.userId}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell align="right">
                                                {onRevokeSession ? (
                                                    <Tooltip
                                                        title="Revoke this session (user will be signed out on that device)"
                                                        slotProps={tooltipSlotProps}
                                                    >
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => onRevokeSession(session.id)}
                                                                disabled={sessionActionId === session.id}
                                                                aria-label="Revoke session"
                                                            >
                                                                {sessionActionId === session.id ? (
                                                                    <CircularProgress size={18} sx={{ color: 'inherit' }} />
                                                                ) : (
                                                                    <Icon component={Trash2} sx={{ fontSize: 18 }} />
                                                                )}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">
                                                        —
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
                    <Icon component={Lock} sx={{ fontSize: 40, margin: '0 auto 8px', display: 'block' }} />
                    <Typography variant="caption">No active sessions</Typography>
                </Box>
            )}
        </>
    );
};
