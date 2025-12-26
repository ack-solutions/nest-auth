/**
 * Login Page
 * 
 * User authentication page with:
 * - Email and password form
 * - Remember me option
 * - MFA redirect handling
 * - Error display
 * - Links to signup and forgot password
 */

import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
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
    FormControlLabel,
    Checkbox,
} from '@mui/material';
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
} from '@mui/icons-material';

import AuthCard from '../components/AuthCard';

/**
 * LoginPage Component
 * 
 * Handles the login flow including:
 * 1. Credential validation
 * 2. API call to authenticate
 * 3. MFA redirect if required
 * 4. Error handling with user feedback
 * 5. Redirect to original destination after login
 */
export default function LoginPage() {
    const { login } = useNestAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get the intended destination (if redirected from protected route)
    const from = (location.state as any)?.from?.pathname || '/dashboard';

    /**
     * Handle form submission
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Attempt login via nest-auth-react
            const response = await login({
                providerName: 'email',
                credentials: {
                    email: email.toLowerCase().trim(),
                    password,
                },
            });

            // Check if MFA is required
            if (response.isRequiresMfa) {
                // Navigate to MFA verification page
                // Pass temporary session data for MFA completion
                navigate('/mfa-verify', {
                    state: {
                        email: email.toLowerCase().trim(),
                        from,
                    },
                });
                return;
            }

            // Login successful
            enqueueSnackbar('Welcome back!', { variant: 'success' });
            navigate(from, { replace: true });

        } catch (err: any) {
            // Handle specific error codes
            const errorMessage = err.message || 'Login failed. Please try again.';
            const errorCode = err.code || err.details?.code;

            // Map common error codes to user-friendly messages
            switch (errorCode) {
                case 'INVALID_CREDENTIALS':
                    setError('Invalid email or password. Please try again.');
                    break;
                case 'USER_NOT_FOUND':
                    setError('No account found with this email.');
                    break;
                case 'ACCOUNT_DISABLED':
                    setError('Your account has been disabled. Please contact support.');
                    break;
                case 'EMAIL_NOT_VERIFIED':
                    setError('Please verify your email before logging in.');
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
            title="Sign In"
            subtitle="Enter your credentials to access your account"
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

                {/* Password Field */}
                <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="current-password"
                    margin="normal"
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

                {/* Remember Me & Forgot Password Row */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        my: 1,
                    }}
                >
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                size="small"
                                disabled={loading}
                            />
                        }
                        label="Remember me"
                        sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
                    />
                    <Link
                        component={RouterLink}
                        to="/forgot-password"
                        variant="body2"
                        sx={{ textDecoration: 'none' }}
                    >
                        Forgot password?
                    </Link>
                </Box>

                {/* Submit Button */}
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading || !email || !password}
                    sx={{ mt: 2, mb: 2, height: 48 }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                </Button>

                {/* Signup Link */}
                <Box sx={{ textAlign: 'center' }}>
                    <Link
                        component={RouterLink}
                        to="/signup"
                        variant="body2"
                        sx={{ textDecoration: 'none' }}
                    >
                        Don't have an account? Sign up
                    </Link>
                </Box>
            </Box>
        </AuthCard>
    );
}
