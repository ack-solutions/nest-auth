/**
 * Signup Page
 * 
 * User registration page with:
 * - Full name (first/last) fields
 * - Email and password fields
 * - Password confirmation
 * - Form validation
 * - Error handling
 */

import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { useSnackbar } from 'notistack';
import {
    Box,
    TextField,
    Button,
    Link,
    Alert,
    InputAdornment,
    IconButton,
    CircularProgress,
    Grid,
} from '@mui/material';
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Person as PersonIcon,
    Visibility,
    VisibilityOff,
} from '@mui/icons-material';

import AuthCard from '../components/AuthCard';

/**
 * SignupPage Component
 * 
 * Handles user registration:
 * 1. Collect user information
 * 2. Validate passwords match
 * 3. Submit to backend
 * 4. Handle success/error
 */
export default function SignupPage() {
    const { signup } = useNestAuth();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Validation
    const passwordsMatch = password === confirmPassword;
    const isPasswordValid = password.length >= 8;

    /**
     * Handle form submission
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Client-side validation
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
            // Attempt signup via nest-auth-react
            await signup({
                email: email.toLowerCase().trim(),
                password,
                // Pass additional data in metadata
                metadata: {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                },
            });

            // Success
            enqueueSnackbar('Account created successfully! Welcome!', {
                variant: 'success'
            });
            navigate('/dashboard', { replace: true });

        } catch (err: any) {
            const errorMessage = err.message || 'Registration failed. Please try again.';
            const errorCode = err.code || err.details?.code;

            // Map common error codes to user-friendly messages
            switch (errorCode) {
                case 'EMAIL_ALREADY_EXISTS':
                case 'USER_ALREADY_EXISTS':
                    setError('An account with this email already exists. Please sign in.');
                    break;
                case 'INVALID_EMAIL':
                    setError('Please enter a valid email address.');
                    break;
                case 'WEAK_PASSWORD':
                    setError('Password is too weak. Use at least 8 characters with mixed case and numbers.');
                    break;
                case 'REGISTRATION_DISABLED':
                    setError('Registration is currently disabled. Please contact support.');
                    break;
                default:
                    setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthCard
            title="Create Account"
            subtitle="Fill in your details to get started"
        >
            <Box component="form" onSubmit={handleSubmit} noValidate>
                {/* Error Alert */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Name Fields */}
                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <TextField
                            fullWidth
                            label="First Name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={loading}
                            autoComplete="given-name"
                            autoFocus
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PersonIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            fullWidth
                            label="Last Name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={loading}
                            autoComplete="family-name"
                            margin="normal"
                        />
                    </Grid>
                </Grid>

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
                    margin="normal"
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <EmailIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                />

                {/* Password Field */}
                <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
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
                                    aria-label="toggle password visibility"
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

                {/* Confirm Password Field */}
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

                {/* Submit Button */}
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading || !email || !password || !confirmPassword}
                    sx={{ mt: 3, mb: 2, height: 48 }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
                </Button>

                {/* Login Link */}
                <Box sx={{ textAlign: 'center' }}>
                    <Link
                        component={RouterLink}
                        to="/login"
                        variant="body2"
                        sx={{ textDecoration: 'none' }}
                    >
                        Already have an account? Sign in
                    </Link>
                </Box>
            </Box>
        </AuthCard>
    );
}
