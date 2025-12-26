/**
 * Protected Route Component
 * 
 * Wrapper component that ensures user is authenticated before rendering children.
 * Redirects to login page if not authenticated.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/**
 * ProtectedRoute
 * 
 * HOC that guards routes requiring authentication.
 * 
 * Behavior:
 * - Loading: Shows spinner while checking auth state
 * - Unauthenticated: Redirects to /login with return URL
 * - Authenticated: Renders children
 * 
 * The return URL is preserved so after login, user returns
 * to their originally requested page.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { status, isAuthenticated } = useNestAuth();
    const location = useLocation();

    // Still determining auth state - show loading
    if (status === 'loading') {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    backgroundColor: 'background.default',
                }}
            >
                <CircularProgress size={48} />
            </Box>
        );
    }

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
        // Save the attempted URL for redirect after login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Authenticated - render children
    return <>{children}</>;
}
