/**
 * Forgot Password Page
 * 
 * Password reset request page:
 * - Email input
 * - Success/error feedback
 * - Link back to login
 */

import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useNestAuth } from '@ackplus/nest-auth-react';
import {
    Box,
    TextField,
    Button,
    Link,
    Alert,
    InputAdornment,
    CircularProgress,
    Typography,
} from '@mui/material';
import {
    Email as EmailIcon,
    CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import AuthCard from '../components/AuthCard';

/**
 * ForgotPasswordPage Component
 * 
 * Handles password reset request:
 * 1. User enters email
 * 2. Request sent to backend
 * 3. Show success message with OTP instructions
 * 4. Redirect to reset password page
 */
export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    // Get auth client from provider (no duplicate instantiation!)
    const { client } = useNestAuth();

    // Form state
    const [email, setEmail] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    /**
     * Handle form submission
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Request password reset via auth client from provider
            await client.forgotPassword({
                email: email.toLowerCase().trim(),
            });

            // Success - show message
            setSuccess(true);
            enqueueSnackbar('Password reset instructions sent!', { variant: 'success' });

        } catch (err: any) {
            // Even if user doesn't exist, show success for security
            // (prevents email enumeration attacks)
            // Backend should return success regardless
            setSuccess(true);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Proceed to reset password page
     */
    const handleProceed = () => {
        navigate('/reset-password', {
            state: { email: email.toLowerCase().trim() },
        });
    };

    // Success state
    if (success) {
        return (
            <AuthCard title="Check Your Email">
                <Box sx={{ textAlign: 'center' }}>
                    <CheckCircleIcon
                        sx={{ fontSize: 64, color: 'success.main', mb: 2 }}
                    />
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        If an account exists for <strong>{email}</strong>, you will receive
                        a password reset code shortly.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Check your email and enter the OTP code on the next screen.
                    </Typography>

                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleProceed}
                        sx={{ mb: 2, height: 48 }}
                    >
                        Enter Reset Code
                    </Button>

                    <Link
                        component={RouterLink}
                        to="/login"
                        variant="body2"
                        sx={{ textDecoration: 'none' }}
                    >
                        Back to Sign In
                    </Link>
                </Box>
            </AuthCard>
        );
    }

    return (
        <AuthCard
            title="Forgot Password"
            subtitle="Enter your email to receive a password reset code"
        >
            <Box component="form" onSubmit={handleSubmit} noValidate>
                {/* Error Alert */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Email Field */}
                <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="email"
                    autoFocus
                    margin="normal"
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <EmailIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />

                {/* Submit Button */}
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading || !email}
                    sx={{ mt: 3, mb: 2, height: 48 }}
                >
                    {loading ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : (
                        'Send Reset Code'
                    )}
                </Button>

                {/* Back to Login Link */}
                <Box sx={{ textAlign: 'center' }}>
                    <Link
                        component={RouterLink}
                        to="/login"
                        variant="body2"
                        sx={{ textDecoration: 'none' }}
                    >
                        Remember your password? Sign in
                    </Link>
                </Box>
            </Box>
        </AuthCard>
    );
}
