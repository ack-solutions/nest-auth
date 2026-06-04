import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { api } from '../services/api';

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
        } catch {
            setAuthenticated(false);
            if (onAuthChange) {
                onAuthChange(false);
            }
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
            <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={64} thickness={4} sx={{ mb: 2 }} />
                    <Typography variant="body1" color="text.secondary" fontWeight="medium">
                        Verifying authentication...
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (!authenticated) {
        return null;
    }

    return <>{children}</>;
};
