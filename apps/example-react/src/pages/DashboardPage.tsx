/**
 * Dashboard Page
 * 
 * Main protected landing page after login.
 * Shows welcome message and quick links.
 */

import { useNestAuth } from '@ackplus/nest-auth-react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    Typography,
    Avatar,
} from '@mui/material';
import {
    Person as PersonIcon,
    Security as SecurityIcon,
    Devices as DevicesIcon,
    VpnKey as VpnKeyIcon,
} from '@mui/icons-material';

/**
 * Quick action cards for navigation
 */
const QUICK_ACTIONS = [
    {
        title: 'Profile',
        description: 'View and update your profile information',
        icon: <PersonIcon sx={{ fontSize: 40 }} />,
        path: '/profile',
        color: '#1976d2',
    },
    {
        title: 'Security',
        description: 'Change password and manage MFA settings',
        icon: <SecurityIcon sx={{ fontSize: 40 }} />,
        path: '/security',
        color: '#00897b',
    },
    {
        title: 'Sessions',
        description: 'View and manage your active sessions',
        icon: <DevicesIcon sx={{ fontSize: 40 }} />,
        path: '/sessions',
        color: '#7b1fa2',
    },
    {
        title: 'API Keys',
        description: 'Manage your API keys (coming soon)',
        icon: <VpnKeyIcon sx={{ fontSize: 40 }} />,
        path: '#',
        color: '#c2185b',
        disabled: true,
    },
];

export default function DashboardPage() {
    const { user } = useNestAuth();
    const navigate = useNavigate();

    // Get display name
    const metadata = (user as any)?.metadata || {};
    const displayName = metadata.firstName
        ? `${metadata.firstName}${metadata.lastName ? ' ' + metadata.lastName : ''}`
        : user?.email?.split('@')[0] || 'User';

    return (
        <Box>
            {/* Welcome Section */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    Welcome back, {displayName}!
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    This is your dashboard. Manage your account settings and security below.
                </Typography>
            </Box>

            {/* User Info Card */}
            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                            sx={{
                                width: 64,
                                height: 64,
                                bgcolor: 'primary.main',
                                fontSize: '1.5rem',
                            }}
                        >
                            {displayName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                            <Typography variant="h6">{displayName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {user?.email}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                                {user?.isVerified ? (
                                    <Typography variant="caption" color="success.main">
                                        ✓ Email verified
                                    </Typography>
                                ) : (
                                    <Typography variant="caption" color="warning.main">
                                        ⚠ Email not verified
                                    </Typography>
                                )}
                                {(user as any)?.isMfaEnabled ? (
                                    <Typography variant="caption" color="success.main">
                                        ✓ MFA enabled
                                    </Typography>
                                ) : (
                                    <Typography variant="caption" color="text.secondary">
                                        MFA not enabled
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Quick Actions Grid */}
            <Typography variant="h6" gutterBottom>
                Quick Actions
            </Typography>
            <Grid container spacing={3}>
                {QUICK_ACTIONS.map((action) => (
                    <Grid item xs={12} sm={6} md={3} key={action.title}>
                        <Card
                            sx={{
                                height: '100%',
                                opacity: action.disabled ? 0.6 : 1,
                            }}
                        >
                            <CardActionArea
                                onClick={() => !action.disabled && navigate(action.path)}
                                disabled={action.disabled}
                                sx={{ height: '100%', p: 2 }}
                            >
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Box
                                        sx={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: '50%',
                                            backgroundColor: action.color + '15',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            mx: 'auto',
                                            mb: 2,
                                            color: action.color,
                                        }}
                                    >
                                        {action.icon}
                                    </Box>
                                    <Typography variant="h6" gutterBottom>
                                        {action.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {action.description}
                                    </Typography>
                                    {action.disabled && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ mt: 1, display: 'block' }}
                                        >
                                            Coming Soon
                                        </Typography>
                                    )}
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
