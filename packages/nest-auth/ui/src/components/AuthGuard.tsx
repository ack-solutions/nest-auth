import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, ApiError } from '../services/api';

interface AuthGuardProps {
    children: React.ReactNode;
    onAuthChange?: (authenticated: boolean) => void;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, onAuthChange }) => {
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            setChecking(true);
            await api.get('/me');
            setAuthenticated(true);
            if (onAuthChange) {
                onAuthChange(true);
            }
        } catch (error) {
            setAuthenticated(false);
            if (onAuthChange) {
                onAuthChange(false);
            }
            // Redirect to login, preserving intended destination
            navigate('/login', {
                replace: true,
                state: { from: location.pathname }
            });
        } finally {
            setChecking(false);
        }
    };

    if (checking) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Verifying authentication...</p>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return null; // Will be redirected by useEffect
    }

    return <>{children}</>;
};
