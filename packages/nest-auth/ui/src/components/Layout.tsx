import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Shield, Building2, BookOpen, UserCog, LogOut, FileText, Key } from 'lucide-react';
import { api } from '../services/api';
import type { DashboardConfig, Admin } from '../types';

interface LayoutProps {
    children: React.ReactNode;
    config: DashboardConfig;
    onLogout: () => Promise<void>;
}

export const Layout: React.FC<LayoutProps> = ({ children, config, onLogout }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const sidebarBg = theme.palette.grey[800];
    const sidebarLight = theme.palette.grey[700];
    const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);

    useEffect(() => {
        const loadCurrentAdmin = async () => {
            try {
                const admin = await api.get<Admin>('/me');
                setCurrentAdmin(admin);
            } catch (error) {
                console.error('Failed to load current admin:', error);
            }
        };
        loadCurrentAdmin();
    }, []);

    const handleLogout = async () => {
        await onLogout();
        navigate('/login', { replace: true });
    };

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/users', icon: Users, label: 'Users' },
        { to: '/roles', icon: Shield, label: 'Roles' },
        { to: '/permissions', icon: Key, label: 'Permissions' },
        { to: '/tenants', icon: Building2, label: 'Tenants' },
        { to: '/api', icon: FileText, label: 'API Docs' },
        ...(config.allowAdminManagement ? [{ to: '/admins', icon: UserCog, label: 'Admins' }] : []),
    ];

    return (
        <Stack direction="row" sx={{ height: '100vh' }}>
            <Stack
                component="aside"
                direction="column"
                sx={{
                    width: 256,
                    bgcolor: sidebarBg,
                    color: 'white',
                    boxShadow: 3,
                }}
            >
                <Box sx={{ p: 3, borderBottom: 1, borderColor: sidebarLight }}>
                    <Typography
                        variant="h5"
                        fontWeight="bold"
                        sx={{
                            background: `linear-gradient(to right, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                            backgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Nest Auth
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'grey.400', mt: 0.5 }}>
                        Admin Dashboard
                    </Typography>
                    {currentAdmin && (
                        <Stack sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: sidebarLight }} spacing={1} direction="row" alignItems="center">
                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                                    {currentAdmin.email.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="caption" fontWeight="medium" noWrap sx={{ color: 'white' }}>
                                        {currentAdmin.email}
                                    </Typography>
                                    {currentAdmin.name && (
                                        <Typography variant="caption" noWrap sx={{ color: 'grey.400', display: 'block' }}>
                                            {currentAdmin.name}
                                        </Typography>
                                    )}
                                </Box>
                        </Stack>
                    )}
                </Box>

                <Stack component="nav" spacing={0.5} sx={{ flex: 1, p: 2, overflow: 'auto' }}>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end
                            style={({ isActive }) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 16px',
                                borderRadius: 8,
                                color: isActive ? theme.palette.primary.contrastText : 'rgba(255,255,255,0.7)',
                                backgroundColor: isActive ? theme.palette.primary.main : 'transparent',
                                textDecoration: 'none',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            })}
                        >
                            <item.icon style={{ width: 20, height: 20, flexShrink: 0 }} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </Stack>

                <Box sx={{ p: 2, borderTop: 1, borderColor: sidebarLight }}>
                    <Button
                        fullWidth
                        variant="contained"
                        color="error"
                        onClick={handleLogout}
                        startIcon={<LogOut style={{ width: 20, height: 20 }} />}
                        sx={{ py: 1.5, fontWeight: 600 }}
                    >
                        Sign out
                    </Button>
                </Box>
            </Stack>

            <Box component="main" sx={{ flex: 1, overflow: 'auto' }}>
                <Box sx={{ p: 4 }}>{children}</Box>
            </Box>
        </Stack>
    );
};
