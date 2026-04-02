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
    Phone as PhoneIcon,
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

export interface PhonePasswordLoginFormProps {
    phone: string;
    password: string;
    rememberMe: boolean;
    showPassword: boolean;
    error: string | null;
    isLoading: boolean;
    onPhoneChange: (v: string) => void;
    onPasswordChange: (v: string) => void;
    onRememberMeChange: (v: boolean) => void;
    onTogglePassword: () => void;
    onSubmit: () => void | Promise<void>;
}

export function PhonePasswordLoginForm({
    phone,
    password,
    rememberMe,
    showPassword,
    error,
    isLoading,
    onPhoneChange,
    onPasswordChange,
    onRememberMeChange,
    onTogglePassword,
    onSubmit,
}: PhonePasswordLoginFormProps) {
    return (
        <Box
            component="form"
            onSubmit={(e) => {
                e.preventDefault();
                void onSubmit();
            }}
            noValidate
        >
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <TextField
                fullWidth
                label="Phone number"
                type="tel"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="tel"
                autoFocus
                margin="normal"
                placeholder="+1 234 567 8900"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <PhoneIcon color="action" />
                        </InputAdornment>
                    ),
                }}
            />

            <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                disabled={isLoading}
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
                                onClick={onTogglePassword}
                                edge="end"
                                disabled={isLoading}
                            >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
            />

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
                            onChange={(e) => onRememberMeChange(e.target.checked)}
                            size="small"
                            disabled={isLoading}
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

            <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading || !phone || !password}
                sx={{ mt: 2, mb: 2, height: 48 }}
            >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
        </Box>
    );
}
