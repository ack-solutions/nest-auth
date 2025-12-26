/**
 * Main Layout Component
 * 
 * Provides the application shell with:
 * - AppBar with user menu
 * - Sidebar navigation drawer
 * - Main content area with Outlet for nested routes
 */

import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { useSnackbar } from 'notistack';
import {
    AppBar,
    Box,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
    Avatar,
    Divider,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    Person as PersonIcon,
    Security as SecurityIcon,
    Devices as DevicesIcon,
    Logout as LogoutIcon,
    Settings as SettingsIcon,
} from '@mui/icons-material';

/** Drawer width constant */
const DRAWER_WIDTH = 240;

/**
 * Navigation items configuration
 */
const NAV_ITEMS = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/profile', label: 'Profile', icon: <PersonIcon /> },
    { path: '/security', label: 'Security', icon: <SecurityIcon /> },
    { path: '/sessions', label: 'Sessions', icon: <DevicesIcon /> },
];

export default function Layout() {
    const { user, logout } = useNestAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Mobile drawer state
    const [mobileOpen, setMobileOpen] = useState(false);

    // User menu anchor
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    /**
     * Handle user menu open/close
     */
    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    /**
     * Handle logout with feedback
     */
    const handleLogout = async () => {
        handleMenuClose();
        try {
            await logout();
            enqueueSnackbar('Logged out successfully', { variant: 'success' });
            navigate('/login');
        } catch (error) {
            enqueueSnackbar('Logout failed', { variant: 'error' });
        }
    };

    /**
     * Navigate to a route and close mobile drawer
     */
    const handleNavigate = (path: string) => {
        navigate(path);
        if (isMobile) {
            setMobileOpen(false);
        }
    };

    /**
     * Get user initials for avatar
     */
    const getUserInitials = () => {
        if (!user) return '?';
        const metadata = (user as any).metadata || {};
        const firstName = metadata.firstName || '';
        const lastName = metadata.lastName || '';
        if (firstName || lastName) {
            return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        }
        return user.email?.charAt(0)?.toUpperCase() || '?';
    };

    /**
     * Drawer content - shared between mobile and desktop
     */
    const drawerContent = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Logo / Title */}
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityIcon color="primary" />
                <Typography variant="h6" color="primary" fontWeight="bold">
                    NestAuth
                </Typography>
            </Box>

            <Divider />

            {/* Navigation Items */}
            <List sx={{ flex: 1, pt: 1 }}>
                {NAV_ITEMS.map((item) => (
                    <ListItem key={item.path} disablePadding>
                        <ListItemButton
                            selected={location.pathname === item.path}
                            onClick={() => handleNavigate(item.path)}
                            sx={{
                                mx: 1,
                                borderRadius: 1,
                                '&.Mui-selected': {
                                    backgroundColor: 'primary.main',
                                    color: 'primary.contrastText',
                                    '& .MuiListItemIcon-root': {
                                        color: 'inherit',
                                    },
                                    '&:hover': {
                                        backgroundColor: 'primary.dark',
                                    },
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.label} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>

            <Divider />

            {/* User info at bottom */}
            <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" noWrap>
                    {user?.email}
                </Typography>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {/* AppBar */}
            <AppBar
                position="fixed"
                sx={{
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { md: `${DRAWER_WIDTH}px` },
                    backgroundColor: 'background.paper',
                    color: 'text.primary',
                }}
            >
                <Toolbar>
                    {/* Mobile menu button */}
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        sx={{ mr: 2, display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    {/* Page title - could be dynamic based on route */}
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        {NAV_ITEMS.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
                    </Typography>

                    {/* User avatar and menu */}
                    <IconButton onClick={handleMenuOpen} size="small">
                        <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                            {getUserInitials()}
                        </Avatar>
                    </IconButton>

                    {/* User dropdown menu */}
                    <Menu
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={handleMenuClose}
                        onClick={handleMenuClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{
                            sx: { mt: 1, minWidth: 180 },
                        }}
                    >
                        <MenuItem onClick={() => handleNavigate('/profile')}>
                            <ListItemIcon>
                                <PersonIcon fontSize="small" />
                            </ListItemIcon>
                            Profile
                        </MenuItem>
                        <MenuItem onClick={() => handleNavigate('/security')}>
                            <ListItemIcon>
                                <SettingsIcon fontSize="small" />
                            </ListItemIcon>
                            Security
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon>
                                <LogoutIcon fontSize="small" />
                            </ListItemIcon>
                            Logout
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Mobile Drawer */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': {
                        boxSizing: 'border-box',
                        width: DRAWER_WIDTH,
                    },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Desktop Drawer */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    '& .MuiDrawer-paper': {
                        boxSizing: 'border-box',
                        width: DRAWER_WIDTH,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                    },
                }}
                open
            >
                {drawerContent}
            </Drawer>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    mt: '64px', // AppBar height
                    backgroundColor: 'background.default',
                    minHeight: 'calc(100vh - 64px)',
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
}
