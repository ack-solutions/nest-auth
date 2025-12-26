/**
 * Sessions Page
 * 
 * Session management:
 * - View all active sessions
 * - Revoke individual sessions
 * - Revoke all sessions
 */

import { useState, useEffect } from 'react';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Divider,
    Tooltip,
} from '@mui/material';
import {
    Computer as ComputerIcon,
    Smartphone as SmartphoneIcon,
    Tablet as TabletIcon,
    Delete as DeleteIcon,
    LogoutOutlined as LogoutAllIcon,
    Refresh as RefreshIcon,
    AccessTime as AccessTimeIcon,
    LocationOn as LocationIcon,
} from '@mui/icons-material';

const API_BASE_URL = 'http://localhost:3000';

interface Session {
    id: string;
    deviceName?: string;
    browser?: string;
    os?: string;
    ipAddress?: string;
    lastActiveAt: string;
    createdAt: string;
    isCurrent: boolean;
}

/**
 * Get device icon based on device name
 */
const getDeviceIcon = (deviceName?: string) => {
    if (!deviceName) return <ComputerIcon />;
    const name = deviceName.toLowerCase();
    if (name.includes('iphone') || name.includes('android') || name.includes('mobile')) {
        return <SmartphoneIcon />;
    }
    if (name.includes('ipad') || name.includes('tablet')) {
        return <TabletIcon />;
    }
    return <ComputerIcon />;
};

/**
 * Format date for display
 */
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
};

export default function SessionsPage() {
    const { client, logout } = useNestAuth();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    // State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        type: 'single' | 'others' | 'all';
        sessionId?: string;
    }>({ open: false, type: 'all' });

    /**
     * Fetch sessions on mount
     */
    useEffect(() => {
        fetchSessions();
    }, []);

    /**
     * Get auth headers
     */
    const getHeaders = async () => {
        const token = await client.getAccessToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    };

    /**
     * Fetch sessions from API
     */
    const fetchSessions = async () => {
        setLoading(true);
        setError(null);

        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/sessions`, { headers });

            if (!response.ok) {
                throw new Error('Failed to fetch sessions');
            }

            const data = await response.json();
            setSessions(data.sessions || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load sessions');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Revoke a single session
     */
    const handleRevokeSession = async (sessionId: string) => {
        setRevoking(sessionId);
        setConfirmDialog({ open: false, type: 'single' });

        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to revoke session');
            }

            enqueueSnackbar('Session revoked successfully', { variant: 'success' });
            await fetchSessions();
        } catch (err: any) {
            enqueueSnackbar(err.message, { variant: 'error' });
        } finally {
            setRevoking(null);
        }
    };

    /**
     * Revoke all other sessions
     */
    const handleRevokeOthers = async () => {
        setConfirmDialog({ open: false, type: 'others' });

        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/sessions/others`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to revoke sessions');
            }

            const data = await response.json();
            enqueueSnackbar(data.message || 'Other sessions revoked', { variant: 'success' });
            await fetchSessions();
        } catch (err: any) {
            enqueueSnackbar(err.message, { variant: 'error' });
        }
    };

    /**
     * Revoke all sessions (including current)
     */
    const handleRevokeAll = async () => {
        setConfirmDialog({ open: false, type: 'all' });

        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/sessions`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to revoke sessions');
            }

            enqueueSnackbar('All sessions revoked. Logging out...', { variant: 'success' });

            // Clear local auth state and redirect to login
            await logout();
            navigate('/login');
        } catch (err: any) {
            enqueueSnackbar(err.message, { variant: 'error' });
        }
    };

    // Loading state
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    const otherSessions = sessions.filter(s => !s.isCurrent);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold" gutterBottom>
                        Active Sessions
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Manage your active login sessions across devices
                    </Typography>
                </Box>
                <IconButton onClick={fetchSessions} title="Refresh">
                    <RefreshIcon />
                </IconButton>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    {/* Session count summary */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1">
                            {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
                        </Typography>
                        {otherSessions.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    size="small"
                                    onClick={() => setConfirmDialog({ open: true, type: 'others' })}
                                >
                                    Sign out other sessions
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    startIcon={<LogoutAllIcon />}
                                    onClick={() => setConfirmDialog({ open: true, type: 'all' })}
                                >
                                    Sign out everywhere
                                </Button>
                            </Box>
                        )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Session list */}
                    <List>
                        {sessions.map((session, index) => (
                            <Box key={session.id}>
                                {index > 0 && <Divider />}
                                <ListItem
                                    sx={{
                                        backgroundColor: session.isCurrent ? 'primary.50' : 'transparent',
                                        borderRadius: 1,
                                        my: 0.5,
                                    }}
                                >
                                    <ListItemIcon>
                                        {getDeviceIcon(session.deviceName)}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="subtitle1">
                                                    {session.deviceName || 'Unknown Device'}
                                                </Typography>
                                                {session.isCurrent && (
                                                    <Chip
                                                        label="Current"
                                                        color="primary"
                                                        size="small"
                                                    />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Box sx={{ mt: 0.5 }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    {session.browser} on {session.os}
                                                </Typography>
                                                <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                                                    {session.ipAddress && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <LocationIcon sx={{ fontSize: 14 }} />
                                                            {session.ipAddress}
                                                        </Typography>
                                                    )}
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <AccessTimeIcon sx={{ fontSize: 14 }} />
                                                        Last active: {formatDate(session.lastActiveAt)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        {!session.isCurrent && (
                                            <Tooltip title="Revoke session">
                                                <IconButton
                                                    edge="end"
                                                    color="error"
                                                    onClick={() => setConfirmDialog({
                                                        open: true,
                                                        type: 'single',
                                                        sessionId: session.id
                                                    })}
                                                    disabled={revoking === session.id}
                                                >
                                                    {revoking === session.id ? (
                                                        <CircularProgress size={24} />
                                                    ) : (
                                                        <DeleteIcon />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </ListItemSecondaryAction>
                                </ListItem>
                            </Box>
                        ))}
                    </List>

                    {sessions.length === 0 && (
                        <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                            No active sessions found
                        </Typography>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
            >
                <DialogTitle>
                    {confirmDialog.type === 'single' && 'Revoke Session'}
                    {confirmDialog.type === 'others' && 'Revoke Other Sessions'}
                    {confirmDialog.type === 'all' && 'Sign Out Everywhere'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmDialog.type === 'single' && (
                            'This will immediately log out the selected device. Are you sure?'
                        )}
                        {confirmDialog.type === 'others' && (
                            'This will log out all devices except your current one. Are you sure?'
                        )}
                        {confirmDialog.type === 'all' && (
                            'This will log you out of ALL devices, including this one. You will need to sign in again. Are you sure?'
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => {
                            if (confirmDialog.type === 'single' && confirmDialog.sessionId) {
                                handleRevokeSession(confirmDialog.sessionId);
                            } else if (confirmDialog.type === 'others') {
                                handleRevokeOthers();
                            } else if (confirmDialog.type === 'all') {
                                handleRevokeAll();
                            }
                        }}
                    >
                        {confirmDialog.type === 'all' ? 'Sign Out Everywhere' : 'Revoke'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
