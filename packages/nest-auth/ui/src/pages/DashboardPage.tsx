import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Building2, Activity, TrendingUp, UserCheck } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { Card } from '../components/Card';

interface DashboardStats {
    totalUsers: number;
    activeUsers: number;
    totalRoles: number;
    totalTenants: number;
    verifiedUsers: number;
    recentSignups: number;
}

export const DashboardPage: React.FC = () => {
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

            // Use the efficient stats endpoint that calculates everything server-side
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
        } catch (error: unknown) {
            // eslint-disable-next-line no-console
            console.error('Failed to load stats:', error instanceof Error ? error : String(error));
            if (error instanceof Error) {
                setError(error.message);
            } else if (typeof error === 'string') {
                setError(error);
            } else {
                try {
                    setError(JSON.stringify(error));
                } catch {
                    setError('Failed to load dashboard stats');
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const userStatusData = [
        { name: 'Active', value: stats.activeUsers, color: '#10b981' },
        { name: 'Inactive', value: stats.totalUsers - stats.activeUsers, color: '#ef4444' },
    ];

    const StatCard: React.FC<{
        title: string;
        value: number;
        icon: React.ReactNode;
        gradientClasses: string;
        borderColor: string;
        iconBg: string;
        trend?: string;
    }> = ({ title, value, icon, gradientClasses, borderColor, iconBg, trend }) => (
        <Card className={`${gradientClasses} ${borderColor} animate-fade-in`} padding="md">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{title}</p>
                    <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
                    {trend && (
                        <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {trend}
                        </p>
                    )}
                </div>
                <div className={`${iconBg} p-2.5 rounded-lg`}>
                    {icon}
                </div>
            </div>
        </Card>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-slide-up">
            {error && (
                <div
                    className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                >
                    {error}
                </div>
            )}
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-600 mt-0.5">Welcome to your Nest Auth admin console</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    title="Total Users"
                    value={stats.totalUsers}
                    icon={<Users className="w-5 h-5 text-blue-600" />}
                    gradientClasses="bg-gradient-to-br from-blue-50 to-blue-100"
                    borderColor="border-blue-200"
                    iconBg="bg-blue-200"
                    trend={`+${stats.recentSignups} this week`}
                />
                <StatCard
                    title="Active Users"
                    value={stats.activeUsers}
                    icon={<Activity className="w-5 h-5 text-green-600" />}
                    gradientClasses="bg-gradient-to-br from-green-50 to-green-100"
                    borderColor="border-green-200"
                    iconBg="bg-green-200"
                />
                <StatCard
                    title="Total Roles"
                    value={stats.totalRoles}
                    icon={<Shield className="w-5 h-5 text-purple-600" />}
                    gradientClasses="bg-gradient-to-br from-purple-50 to-purple-100"
                    borderColor="border-purple-200"
                    iconBg="bg-purple-200"
                />
                <StatCard
                    title="Tenants"
                    value={stats.totalTenants}
                    icon={<Building2 className="w-5 h-5 text-orange-600" />}
                    gradientClasses="bg-gradient-to-br from-orange-50 to-orange-100"
                    borderColor="border-orange-200"
                    iconBg="bg-orange-200"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* User Activity Chart */}
                <Card padding="md">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">User Sign-ups (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={userActivityData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                            />
                            <Bar dataKey="users" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* User Status Pie Chart */}
                <Card padding="md">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">User Status Distribution</h3>
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={userStatusData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={90}
                                fill="#8884d8"
                                dataKey="value"
                                fontSize={12}
                            >
                                {userStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Verification Status */}
                <Card padding="md">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Email Verification Status</h3>
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">Verified Users</span>
                            </div>
                            <span className="text-xl font-bold text-blue-600">{stats.verifiedUsers}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-medium text-gray-900">Unverified Users</span>
                            </div>
                            <span className="text-xl font-bold text-orange-600">
                                {stats.totalUsers - stats.verifiedUsers}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Quick Stats */}
                <Card padding="md">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Quick Stats</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-600">Verification Rate</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {stats.totalUsers > 0
                                    ? `${((stats.verifiedUsers / stats.totalUsers) * 100).toFixed(1)}%`
                                    : '0%'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-600">Active User Rate</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {stats.totalUsers > 0
                                    ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%`
                                    : '0%'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-xs text-gray-600">Avg Roles per User</span>
                            <span className="text-sm font-semibold text-gray-900">
                                {stats.totalUsers > 0 ? (stats.totalRoles / stats.totalUsers).toFixed(1) : '0'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-xs text-gray-600">Recent Sign-ups (7d)</span>
                            <span className="text-sm font-semibold text-green-600">+{stats.recentSignups}</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
