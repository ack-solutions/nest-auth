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
import { Link as RouterLink } from 'react-router-dom';

export interface EmailPasswordLoginFormProps {
    email: string;
    password: string;
    rememberMe: boolean;
    showPassword: boolean;
    error: string | null;
    isLoading: boolean;
    onEmailChange: (v: string) => void;
    onPasswordChange: (v: string) => void;
    onRememberMeChange: (v: boolean) => void;
    onTogglePassword: () => void;
    onSubmit: () => void | Promise<void>;
}

export function EmailPasswordLoginForm({
    email,
    password,
    rememberMe,
    showPassword,
    error,
    isLoading,
    onEmailChange,
    onPasswordChange,
    onRememberMeChange,
    onTogglePassword,
    onSubmit,
}: EmailPasswordLoginFormProps) {
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
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                disabled={isLoading}
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
                disabled={isLoading || !email || !password}
                sx={{ mt: 2, mb: 2, height: 48 }}
            >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
        </Box>
    );
}
