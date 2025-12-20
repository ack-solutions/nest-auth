import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api';
import { ConfirmProvider } from './hooks/useConfirm';
import type { DashboardConfig } from './types';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { TenantsPage } from './pages/TenantsPage';
import { AdminsPage } from './pages/AdminsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { ApiPage } from './pages/ApiPage';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{
    children: React.ReactNode;
    authenticated: boolean | null;
}> = ({ children, authenticated }) => {
    // While checking auth, show loading
    if (authenticated === null) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Verifying authentication...</p>
                </div>
            </div>
        );
    }

    // If not authenticated, redirect to login
    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render children
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
            // First check authentication
            await api.get('/me');
            setAuthenticated(true);

            // Then load config
            const configData = await api.get<DashboardConfig>('/config');
            setConfig(configData);
        } catch (err: any) {
            console.error('Auth check failed:', err);
            setAuthenticated(false);

            // Still load config for login page
            try {
                const configData = await api.get<DashboardConfig>('/config');
                setConfig(configData);
            } catch (configErr) {
                console.error('Failed to load config:', configErr);
                // Set default config
                setConfig({
                    allowAdminManagement: false,
                });
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
            // Recheck auth after successful login
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

    // Show loading screen while checking auth or loading config
    if (!authChecked || config === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4 shadow-lg">
                        <svg className="w-8 h-8 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <p className="text-gray-700 font-medium text-lg">Loading Nest Auth Dashboard...</p>
                    <p className="text-gray-500 text-sm mt-2">Verifying authentication</p>
                </div>
            </div>
        );
    }

    return (
        <ConfirmProvider>
            <HashRouter>
                <Routes>
                    {/* Login Route - Only accessible when NOT authenticated */}
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

                    {/* Protected Routes - Only accessible when authenticated */}
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

                    {/* Default redirects */}
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

                    {/* Catch all - redirect based on auth status */}
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
        </ConfirmProvider>
    );
};
