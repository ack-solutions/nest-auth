import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../services/api';

interface AuthContextType {
    authenticated: boolean | null;
    checkAuth: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);
    const navigate = useNavigate();

    const checkAuth = useCallback(async () => {
        try {
            await api.get('/me');
            setAuthenticated(true);
        } catch (err) {
            setAuthenticated(false);
        }
    }, []);

    const logout = useCallback(() => {
        setAuthenticated(false);
        navigate('/login', { replace: true });
    }, [navigate]);

    // Setup global API error interceptor
    useEffect(() => {
        const originalRequest = api.request.bind(api);

        api.request = async function <T>(endpoint: string, options?: any): Promise<T> {
            try {
                return await originalRequest(endpoint, options);
            } catch (error) {
                if (error instanceof ApiError) {
                    // Session expired or unauthorized
                    if (error.status === 401 || error.status === 403) {
                        // Skip logout for login/setup/reset-password endpoints
                        if (!endpoint.includes('/login') &&
                            !endpoint.includes('/setup') &&
                            !endpoint.includes('/reset-password') &&
                            !endpoint.includes('/config')) {
                            console.warn('Session expired, logging out...');
                            logout();
                        }
                    }
                }
                throw error;
            }
        };

        return () => {
            api.request = originalRequest;
        };
    }, [logout]);

    const value = {
        authenticated,
        checkAuth,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
