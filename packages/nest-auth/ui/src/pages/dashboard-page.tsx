import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Building2, Activity, TrendingUp, UserCheck } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Grid, Stack, Typography, Alert, CircularProgress, Icon } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { api } from '../services/api';
import Paper from '@mui/material/Paper';

interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    totalRoles: number;
    totalTenants: number;
    verifiedUsers: number;
    recentSignups: number;
}

export const DashboardPage: React.FC = () => {
    const theme = useTheme();
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        activeUsers: 0,
        totalRoles: 0,
        totalTenants: 0,
        verifiedUsers: 0,
        recentSignups: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userActivityData, setUserActivityData] = useState<Array<{ name: string; users: number }>>([]);

    const loadStats = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);

            const statsResponse = await api.get<{
                stats: {
                    totalUsers: number;
                    activeUsers: number;
                    verifiedUsers: number;
                    totalRoles: number;
                    totalTenants: number;
                    recentSignups: number;
                };
                activityData: Array<{ name: string; users: number }>;
            }>('/api/stats');

            setUserActivityData(statsResponse.activityData || []);

            setStats({
                totalUsers: statsResponse.stats.totalUsers,
                activeUsers: statsResponse.stats.activeUsers,
                totalRoles: statsResponse.stats.totalRoles,
                totalTenants: statsResponse.stats.totalTenants,
                verifiedUsers: statsResponse.stats.verifiedUsers,
                recentSignups: statsResponse.stats.recentSignups,
            });
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
            else if (typeof err === 'string') setError(err);
            else setError('Failed to load dashboard stats');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const userStatusData = [
        { name: 'Active', value: stats.activeUsers, color: theme.palette.success.main },
        { name: 'Inactive', value: stats.totalUsers - stats.activeUsers, color: theme.palette.error.main },
    ];

    const StatCard: React.FC<{
        title: string;
        value: number;
        icon: React.ReactNode;
        gradient: string;
        borderColor: string;
        iconBg: string;
        trend?: string;
    }> = ({ title, value, icon, gradient, borderColor, iconBg, trend }) => (
        <Paper
            elevation={0}
            sx={{ p: 3,
                height: '100%',
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack spacing={0.5}>
                    <Typography variant="caption" fontWeight="500" color="text.secondary">{title}</Typography>
                    <Typography variant="h5" fontWeight="bold">{value.toLocaleString()}</Typography>
                    {trend && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Icon component={TrendingUp} sx={{ fontSize: 14 }} />
                            <Typography variant="caption" color="success.main">{trend}</Typography>
                        </Stack>
                    )}
                </Stack>
                <Box sx={{ bgcolor: iconBg, p: 1.25, borderRadius: 1 }}>{icon}</Box>
            </Stack>
        </Paper>
    );

    if (loading) {
        return (
            <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '80vh' }}>
                <CircularProgress size={48} />
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
                    {error}
                </Alert>
            )}

            <Box>
                <Typography variant="h5" fontWeight="bold">Dashboard</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Welcome to your Nest Auth admin console</Typography>
            </Box>

            <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <StatCard
                        title="Total Users"
                        value={stats.totalUsers}
                        icon={<Icon component={Users} sx={{ fontSize: 20, color: 'primary.main' }} />}
                        gradient={`linear-gradient(to bottom right, ${theme.palette.primary[50]}, ${theme.palette.primary[100]})`}
                        borderColor="primary.200"
                        iconBg="primary.200"
                        trend={`+${stats.recentSignups} this week`}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <StatCard
                        title="Active Users"
                        value={stats.activeUsers}
                        icon={<Icon component={Activity} sx={{ fontSize: 20, color: 'success.main' }} />}
                        gradient={`linear-gradient(to bottom right, ${theme.palette.success[50]}, ${theme.palette.success[100]})`}
                        borderColor="success.200"
                        iconBg="success.200"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <StatCard
                        title="Total Roles"
                        value={stats.totalRoles}
                        icon={<Icon component={Shield} sx={{ fontSize: 20, color: 'secondary.main' }} />}
                        gradient={`linear-gradient(to bottom right, ${theme.palette.secondary[50]}, ${theme.palette.secondary[100]})`}
                        borderColor="secondary.200"
                        iconBg="secondary.200"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <StatCard
                        title="Tenants"
                        value={stats.totalTenants}
                        icon={<Icon component={Building2} sx={{ fontSize: 20, color: 'warning.main' }} />}
                        gradient={`linear-gradient(to bottom right, ${theme.palette.warning[50]}, ${theme.palette.warning[100]})`}
                        borderColor="warning.200"
                        iconBg="warning.200"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper elevation={0} sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1.5 }}>User Sign-ups (Last 7 Days)</Typography>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={userActivityData}>
<CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                            <XAxis dataKey="name" stroke={theme.palette.text.secondary} fontSize={12} />
                            <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="users" fill={theme.palette.primary.main} radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper elevation={0} sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1.5 }}>User Status Distribution</Typography>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={userStatusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={90}
                                    fill={theme.palette.primary.main}
                                    dataKey="value"
                                    fontSize={12}
                                >
                                    {userStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper elevation={0} sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1.5 }}>Email Verification Status</Typography>
                        <Stack spacing={1.25}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 1 }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Icon component={UserCheck} sx={{ fontSize: 16, color: 'primary.main' }} />
                                    <Typography variant="body2" fontWeight="500">Verified Users</Typography>
                                </Stack>
                                <Typography variant="h6" fontWeight="bold" color="primary.main">{stats.verifiedUsers}</Typography>
                            </Stack>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.5, bgcolor: 'warning.50', borderRadius: 1 }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Icon component={Activity} sx={{ fontSize: 16, color: 'warning.main' }} />
                                    <Typography variant="body2" fontWeight="500">Unverified Users</Typography>
                                </Stack>
                                <Typography variant="h6" fontWeight="bold" color="warning.main">{stats.totalUsers - stats.verifiedUsers}</Typography>
                            </Stack>
                        </Stack>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper elevation={0} sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1.5 }}>Quick Stats</Typography>
                        <Stack sx={{ '& > div': { py: 1, borderBottom: '1px solid', borderColor: 'divider' }, '& > div:last-of-type': { borderBottom: 0 } }} divider={null}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">Verification Rate</Typography>
                                <Typography variant="body2" fontWeight="600">
                                    {stats.totalUsers > 0 ? `${((stats.verifiedUsers / stats.totalUsers) * 100).toFixed(1)}%` : '0%'}
                                </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">Active User Rate</Typography>
                                <Typography variant="body2" fontWeight="600">
                                    {stats.totalUsers > 0 ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%` : '0%'}
                                </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary">Avg Roles per User</Typography>
                                <Typography variant="body2" fontWeight="600">
                                    {stats.totalUsers > 0 ? (stats.totalRoles / stats.totalUsers).toFixed(1) : '0'}
                                </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1 }}>
                                <Typography variant="caption" color="text.secondary">Recent Sign-ups (7d)</Typography>
                                <Typography variant="body2" fontWeight="600" color="success.main">+{stats.recentSignups}</Typography>
                            </Stack>
                        </Stack>
                    </Paper>
                </Grid>
            </Grid>
        </Stack>
    );
};
