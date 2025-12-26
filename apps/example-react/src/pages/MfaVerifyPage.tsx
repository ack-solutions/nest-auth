/**
 * MFA Verify Page
 * 
 * Multi-factor authentication verification during login:
 * - OTP code input
 * - Support for different MFA methods (TOTP, Email)
 * - Recovery code fallback
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
    CircularProgress,
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    Divider,
} from '@mui/material';
import {
    Pin as PinIcon,
    Key as KeyIcon,
    Smartphone as SmartphoneIcon,
    Email as EmailIcon,
} from '@mui/icons-material';

import AuthCard from '../components/AuthCard';

/**
 * MfaVerifyPage Component
 * 
 * Handles MFA verification after initial login:
 * 1. User enters OTP from authenticator app
 * 2. Or enters recovery code
 * 3. Successful verification completes login
 */
export default function MfaVerifyPage() {
    const { verify2fa } = useNestAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { enqueueSnackbar } = useSnackbar();

    // Get data from login flow
    const email = (location.state as any)?.email || '';
    const from = (location.state as any)?.from || '/dashboard';

    // Form state
    const [otp, setOtp] = useState('');
    const [method, setMethod] = useState<'totp' | 'recovery'>('totp');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Redirect if no email (user navigated directly)
    if (!email) {
        navigate('/login', { replace: true });
        return null;
    }

    /**
     * Handle OTP verification
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Verify MFA code
            await verify2fa({
                otp: otp.trim(),
                method: method === 'recovery' ? 'recovery' : 'totp',
            });

            // Success - login complete
            enqueueSnackbar('Verification successful!', { variant: 'success' });
            navigate(from, { replace: true });

        } catch (err: any) {
            const errorCode = err.code || err.details?.code;

            switch (errorCode) {
                case 'INVALID_OTP':
                case 'MFA_CODE_INVALID':
                    setError('Invalid code. Please try again.');
                    break;
                case 'OTP_EXPIRED':
                    setError('Code expired. Please generate a new one.');
                    break;
                case 'RECOVERY_CODE_USED':
                    setError('This recovery code has already been used.');
                    break;
                case 'SESSION_EXPIRED':
                    setError('Session expired. Please login again.');
                    setTimeout(() => navigate('/login'), 2000);
                    break;
                default:
                    setError(err.message || 'Verification failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthCard title="Two-Factor Authentication">
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
                Enter the verification code from your authenticator app
            </Typography>

            <Box component="form" onSubmit={handleSubmit} noValidate>
                {/* Error Alert */}
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Method Toggle */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <ToggleButtonGroup
                        value={method}
                        exclusive
                        onChange={(_, value) => value && setMethod(value)}
                        size="small"
                    >
                        <ToggleButton value="totp">
                            <SmartphoneIcon sx={{ mr: 1 }} />
                            Authenticator
                        </ToggleButton>
                        <ToggleButton value="recovery">
                            <KeyIcon sx={{ mr: 1 }} />
                            Recovery Code
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {/* OTP/Recovery Code Input */}
                {method === 'totp' ? (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                            Open your authenticator app and enter the 6-digit code
                        </Typography>
                        <TextField
                            fullWidth
                            label="Verification Code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            disabled={loading}
                            required
                            autoFocus
                            placeholder="000000"
                            inputProps={{
                                maxLength: 6,
                                style: { letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.5rem' },
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <PinIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 2 }}
                        />
                    </>
                ) : (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                            Enter one of your recovery codes
                        </Typography>
                        <TextField
                            fullWidth
                            label="Recovery Code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            disabled={loading}
                            required
                            autoFocus
                            placeholder="xxxx-xxxx-xxxx"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <KeyIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 2 }}
                        />
                    </>
                )}

                {/* Submit Button */}
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading || !otp || (method === 'totp' && otp.length !== 6)}
                    sx={{ mt: 2, mb: 2, height: 48 }}
                >
                    {loading ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : (
                        'Verify'
                    )}
                </Button>

                <Divider sx={{ my: 2 }} />

                {/* Help text */}
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>
                    Having trouble?
                </Typography>

                {/* Back to Login Link */}
                <Box sx={{ textAlign: 'center' }}>
                    <Link
                        component={RouterLink}
                        to="/login"
                        variant="body2"
                        sx={{ textDecoration: 'none' }}
                    >
                        Start over with a different account
                    </Link>
                </Box>
            </Box>
        </AuthCard>
    );
}
