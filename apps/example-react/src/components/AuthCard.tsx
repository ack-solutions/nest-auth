/**
 * Auth Card Component
 * 
 * Reusable centered card layout for authentication pages.
 * Provides consistent styling for login, signup, forgot password, etc.
 */

import { Box, Card, CardContent, Typography, Container } from '@mui/material';
import { Security as SecurityIcon } from '@mui/icons-material';

interface AuthCardProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    maxWidth?: 'xs' | 'sm' | 'md';
}

/**
 * AuthCard
 * 
 * A centered card component for auth pages with:
 * - Brand logo/icon
 * - Title and optional subtitle
 * - Content area for forms
 * 
 * Usage:
 * ```tsx
 * <AuthCard title="Sign In" subtitle="Welcome back!">
 *   <LoginForm />
 * </AuthCard>
 * ```
 */
export default function AuthCard({
    title,
    subtitle,
    children,
    maxWidth = 'xs',
}: AuthCardProps) {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'background.default',
                py: 4,
            }}
        >
            <Container maxWidth={maxWidth}>
                {/* Logo */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        mb: 3,
                    }}
                >
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            backgroundColor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 2,
                        }}
                    >
                        <SecurityIcon sx={{ color: 'white', fontSize: 32 }} />
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                        NestAuth
                    </Typography>
                </Box>

                {/* Card */}
                <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 4 }}>
                        {/* Title */}
                        <Typography
                            variant="h5"
                            component="h1"
                            textAlign="center"
                            fontWeight="600"
                            gutterBottom
                        >
                            {title}
                        </Typography>

                        {/* Subtitle */}
                        {subtitle && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                textAlign="center"
                                sx={{ mb: 3 }}
                            >
                                {subtitle}
                            </Typography>
                        )}

                        {/* Form content */}
                        {children}
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
