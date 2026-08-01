import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api, ApiError } from './services/api';
import { ConfirmProvider } from './hooks/use-confirm';
import { ClientConfigProvider } from './hooks/use-client-config';
import type { DashboardConfig } from './types';
import { Layout } from './components/layout';
import { LoginPage } from './pages/login-page';
import { DashboardPage } from './pages/dashboard-page';
import { UsersPage } from './pages/users-page';
import { UserDetailPage } from './pages/user-detail-page';
import { RolesPage } from './pages/roles-page';
import { TenantsPage } from './pages/tenants-page';
import { AdminsPage } from './pages/admins-page';
import { PermissionsPage } from './pages/permissions-page';
import { BlockedDomainsPage } from './pages/blocked-domains-page';
import { ApiPage } from './pages/api-page';

const ProtectedRoute: React.FC<{
    children: React.ReactNode;
    authenticated: boolean | null;
}> = ({ children, authenticated }) => {
    if (authenticated === null) {
        return (
            <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={64} sx={{ mb: 2 }} />
                    <Typography color="text.secondary" fontWeight="medium">
                        Verifying authentication...
                    </Typography>
                </Box>
            </Box>
        );
    }
    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

export const App: React.FC = () => {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);
    const [config, setConfig] = useState<DashboardConfig | null>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    useEffect(() => {
        checkAuthAndLoadConfig();
    }, []);

    const checkAuthAndLoadConfig = async () => {
        try {
            await api.get('/me');
            setAuthenticated(true);
            const configData = await api.get<DashboardConfig>('/config');
            setConfig(configData);
        } catch (err: unknown) {
            const status = err instanceof ApiError ? err.status : undefined;
            const expectedUnauthenticated = status === 401 || status === 403;
            if (!expectedUnauthenticated) {
                console.error('Auth check failed:', err);
            }
            setAuthenticated(false);
            try {
                const configData = await api.get<DashboardConfig>('/config');
                setConfig(configData);
            } catch (configErr) {
                console.error('Failed to load config:', configErr);
                setConfig({ allowAdminManagement: false });
            }
        } finally {
            setAuthChecked(true);
        }
    };

    const handleLogin = async (credentials: any) => {
        setLoginError(null);
        try {
            await api.post('/login', credentials);
            setAuthenticated(true);
            await checkAuthAndLoadConfig();
        } catch (err: any) {
            setAuthenticated(false);
            setLoginError(err?.message || 'Login failed');
            throw err;
        }
    };

    const handleLogout = async () => {
        try {
            await api.post('/logout', {});
        } catch (err) {
            console.error('Logout failed:', err);
        }
        setAuthenticated(false);
    };

    if (!authChecked || config === null) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #e9d5ff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={64} sx={{ color: 'primary.main', mb: 2 }} />
                    <Typography color="text.primary" fontWeight="medium" variant="h6">
                        Loading Nest Auth Dashboard...
                    </Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                        Verifying authentication
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <ConfirmProvider>
            <ClientConfigProvider>
            <HashRouter>
                <Routes>
                    <Route
                        path="/login"
                        element={
                            authenticated ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <LoginPage onLogin={handleLogin} error={loginError} />
                            )
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <DashboardPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/users"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <UsersPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/users/:id"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <UserDetailPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/roles"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <RolesPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/tenants"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <TenantsPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/permissions"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <PermissionsPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/blocked-domains"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <BlockedDomainsPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/api"
                        element={
                            <ProtectedRoute authenticated={authenticated}>
                                <Layout config={config} onLogout={handleLogout}>
                                    <ApiPage />
                                </Layout>
                            </ProtectedRoute>
                        }
                    />
                    {config.allowAdminManagement && (
                        <Route
                            path="/admins"
                            element={
                                <ProtectedRoute authenticated={authenticated}>
                                    <Layout config={config} onLogout={handleLogout}>
                                        <AdminsPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />
                    )}
                    <Route
                        path="/"
                        element={
                            authenticated ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                    <Route
                        path="*"
                        element={
                            authenticated ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                </Routes>
            </HashRouter>
            </ClientConfigProvider>
        </ConfirmProvider>
    );
};
