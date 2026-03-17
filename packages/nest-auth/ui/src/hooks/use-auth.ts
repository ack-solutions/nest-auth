import { useState, useCallback, useEffect } from 'react';
import { api, ApiError } from '../services/api';
import type { LoginForm } from '../types';

interface UseAuthResult {
    authenticated: boolean | null;
    loading: boolean;
    error: string | null;
    login: (credentials: LoginForm) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const checkAuth = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            await api.get('/me');
            setAuthenticated(true);
        } catch (err: any) {
            setAuthenticated(false);
            // Don't set error for 401/403 - these are expected for unauthenticated users
            if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                return;
            }
            setError(err.message || 'Authentication check failed');
        } finally {
            setLoading(false);
        }
    }, []);

    const login = useCallback(async (credentials: LoginForm) => {
        try {
            setLoading(true);
            setError(null);
            await api.post('/login', credentials);
            setAuthenticated(true);
        } catch (err: any) {
            setError(err.message || 'Login failed');
            setAuthenticated(false);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            await api.post('/logout', {});
        } catch (err: any) {
            console.error('Logout error:', err);
            // Continue with logout even if API call fails
        } finally {
            setAuthenticated(false);
            setLoading(false);
        }
    }, []);

    // Check auth on mount
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Setup API error interceptor for session expiry
    useEffect(() => {
        const originalRequest = api.request;

        api.request = async function <T>(...args: any[]): Promise<T> {
            try {
                return await originalRequest.apply(api, args);
            } catch (error) {
                if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                    // Session expired or unauthorized
                    setAuthenticated(false);
                }
                throw error;
            }
        };

        return () => {
            api.request = originalRequest;
        };
    }, []);

    return {
        authenticated,
        loading,
        error,
        login,
        logout,
        checkAuth,
    };
}
