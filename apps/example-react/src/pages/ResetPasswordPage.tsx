/**
 * Reset Password Page
 * 
 * Password reset with OTP verification:
 * - Step 1: Enter OTP code from email
 * - Step 2: Enter new password
 * - Handles token-based reset flow
 */

import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useNestAuth } from '@ackplus/nest-auth-react';
import {
    Box,
    TextField,
    Button,
    Link,
    Alert,
    InputAdornment,
    IconButton,
    CircularProgress,
    Typography,
    Stepper,
    Step,
    StepLabel,
} from '@mui/material';
import {
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
    Pin as PinIcon,
} from '@mui/icons-material';

import AuthCard from '../components/AuthCard';

const STEPS = ['Verify Code', 'New Password'];

/**
 * ResetPasswordPage Component
 * 
 * Two-step password reset:
 * 1. Verify OTP code from email
 * 2. Set new password with confirmation
 */
export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();

    // Get auth client from provider (no duplicate instantiation!)
    const { client } = useNestAuth();

    // Get email from navigation state (from forgot password page)
    const emailFromState = (location.state as any)?.email || '';

    // Form state
    const [email, setEmail] = useState(emailFromState);
    const [otp, setOtp] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // UI state
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Validation
    const passwordsMatch = password === confirmPassword;
    const isPasswordValid = password.length >= 8;

    /**
     * Step 1: Verify OTP code
     */
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Verify the OTP and get reset token using client from provider
            const response = await client.verifyForgotPasswordOtp({
                email: email.toLowerCase().trim(),
                otp: otp.trim(),
            });

            // Store the reset token for step 2
            setResetToken(response.token);
            setActiveStep(1);
            enqueueSnackbar('Code verified! Enter your new password.', {
                variant: 'success'
            });

        } catch (err: any) {
            const errorCode = err.code || err.details?.code;

            switch (errorCode) {
                case 'INVALID_OTP':
                case 'OTP_EXPIRED':
                    setError('Invalid or expired code. Please try again or request a new one.');
                    break;
                case 'TOO_MANY_ATTEMPTS':
                    setError('Too many attempts. Please request a new reset code.');
                    break;
                default:
                    setError(err.message || 'Verification failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    /**
     * Step 2: Reset password with token
     */
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate passwords
        if (!passwordsMatch) {
            setError('Passwords do not match');
            return;
        }

        if (!isPasswordValid) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            // Reset password using the token via client from provider
            await client.resetPassword({
                token: resetToken,
                password: password,
            });

            enqueueSnackbar('Password reset successfully! Please sign in.', {
                variant: 'success'
            });
            navigate('/login', { replace: true });

        } catch (err: any) {
            const errorCode = err.code || err.details?.code;

            switch (errorCode) {
                case 'TOKEN_EXPIRED':
                    setError('Reset token expired. Please start over.');
                    break;
                case 'WEAK_PASSWORD':
                    setError('Password is too weak. Use at least 8 characters with mixed case and numbers.');
                    break;
                default:
                    setError(err.message || 'Password reset failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthCard title="Reset Password">
            {/* Stepper */}
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {STEPS.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Step 1: Verify OTP */}
            {activeStep === 0 && (
                <Box component="form" onSubmit={handleVerifyOtp} noValidate>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Enter the 6-digit code sent to your email.
                    </Typography>

                    {/* Email Field (if not from state) */}
                    {!emailFromState && (
                        <TextField
                            fullWidth
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            required
                            autoComplete="email"
                            margin="normal"
                        />
                    )}

                    {/* OTP Field */}
                    <TextField
                        fullWidth
                        label="Verification Code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={loading}
                        required
                        autoFocus
                        margin="normal"
                        placeholder="000000"
                        inputProps={{
                            maxLength: 6,
                            style: { letterSpacing: '0.5em', textAlign: 'center' },
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <PinIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading || !email || otp.length !== 6}
                        sx={{ mt: 3, mb: 2, height: 48 }}
                    >
                        {loading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            'Verify Code'
                        )}
                    </Button>

                    <Box sx={{ textAlign: 'center' }}>
                        <Link
                            component={RouterLink}
                            to="/forgot-password"
                            variant="body2"
                            sx={{ textDecoration: 'none' }}
                        >
                            Didn't receive a code? Request again
                        </Link>
                    </Box>
                </Box>
            )}

            {/* Step 2: Set New Password */}
            {activeStep === 1 && (
                <Box component="form" onSubmit={handleResetPassword} noValidate>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Enter your new password below.
                    </Typography>

                    {/* New Password */}
                    <TextField
                        fullWidth
                        label="New Password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                        autoFocus
                        autoComplete="new-password"
                        margin="normal"
                        error={password.length > 0 && !isPasswordValid}
                        helperText={
                            password.length > 0 && !isPasswordValid
                                ? 'Password must be at least 8 characters'
                                : ''
                        }
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LockIcon color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => setShowPassword(!showPassword)}
                                        edge="end"
                                        disabled={loading}
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    {/* Confirm Password */}
                    <TextField
                        fullWidth
                        label="Confirm Password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        required
                        autoComplete="new-password"
                        margin="normal"
                        error={confirmPassword.length > 0 && !passwordsMatch}
                        helperText={
                            confirmPassword.length > 0 && !passwordsMatch
                                ? 'Passwords do not match'
                                : ''
                        }
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LockIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading || !password || !confirmPassword}
                        sx={{ mt: 3, mb: 2, height: 48 }}
                    >
                        {loading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            'Reset Password'
                        )}
                    </Button>
                </Box>
            )}

            {/* Back to Login Link */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
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
