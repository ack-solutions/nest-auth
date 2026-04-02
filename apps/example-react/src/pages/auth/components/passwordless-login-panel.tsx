import {
    Box,
    TextField,
    Button,
    Alert,
    InputAdornment,
    CircularProgress,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Typography,
} from '@mui/material';
import { Email as EmailIcon, Sms as SmsIcon, Pin as PinIcon } from '@mui/icons-material';
import type { PasswordlessChannel } from '../../../hooks/use-login-flow';

export interface PasswordlessLoginPanelProps {
    phase: 'send' | 'verify';
    identifier: string;
    channel: PasswordlessChannel;
    code: string;
    sentToLabel?: string;
    error: string | null;
    isLoading: boolean;
    onIdentifierChange: (v: string) => void;
    onChannelChange: (c: PasswordlessChannel) => void;
    onCodeChange: (v: string) => void;
    /** Used when `phase` is `send`. */
    onSend?: () => void | Promise<void>;
    /** Used when `phase` is `verify`. */
    onVerify: () => void | Promise<void>;
    onBack: () => void;
}

/**
 * Request a one-time code (email or SMS), then verify to complete passwordless sign-in.
 */
export function PasswordlessLoginPanel({
    phase,
    identifier,
    channel,
    code,
    sentToLabel,
    error,
    isLoading,
    onIdentifierChange,
    onChannelChange,
    onCodeChange,
    onSend,
    onVerify,
    onBack,
}: PasswordlessLoginPanelProps) {
    if (phase === 'verify') {
        return (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); void onVerify(); }} noValidate>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                {sentToLabel && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Code sent to {sentToLabel}
                    </Typography>
                )}
                <TextField
                    fullWidth
                    label="One-time code"
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    disabled={isLoading}
                    required
                    autoFocus
                    margin="normal"
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
                    disabled={isLoading || !code}
                    sx={{ mt: 2, mb: 1, height: 48 }}
                >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Verify & sign in'}
                </Button>
                <Button fullWidth variant="text" onClick={onBack} disabled={isLoading}>
                    Use a different email or number
                </Button>
            </Box>
        );
    }

    return (
        <Box
            component="form"
            onSubmit={(e) => {
                e.preventDefault();
                void onSend?.();
            }}
            noValidate
        >
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                We&apos;ll send a one-time code. Choose where to send it.
            </Typography>
            <FormControl sx={{ mt: 1, mb: 1 }}>
                <FormLabel>Send code via</FormLabel>
                <RadioGroup
                    row
                    value={channel}
                    onChange={(e) => onChannelChange(e.target.value as PasswordlessChannel)}
                >
                    <FormControlLabel value="email" control={<Radio />} label="Email" disabled={isLoading} />
                    <FormControlLabel value="sms" control={<Radio />} label="SMS" disabled={isLoading} />
                </RadioGroup>
            </FormControl>
            <TextField
                fullWidth
                label="Email or phone"
                value={identifier}
                onChange={(e) => onIdentifierChange(e.target.value)}
                disabled={isLoading}
                required
                autoFocus
                margin="normal"
                autoComplete="username"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            {channel === 'sms' ? <SmsIcon color="action" /> : <EmailIcon color="action" />}
                        </InputAdornment>
                    ),
                }}
            />
          
            <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading || !identifier.trim()}
                sx={{ mt: 2, height: 48 }}
            >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Send code'}
            </Button>
        </Box>
    );
}
