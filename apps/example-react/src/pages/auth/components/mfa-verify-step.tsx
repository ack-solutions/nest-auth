import {
    Box,
    TextField,
    Button,
    Alert,
    InputAdornment,
    CircularProgress,
    FormControlLabel,
    Checkbox,
    Typography,
} from '@mui/material';
import { Pin as PinIcon } from '@mui/icons-material';
import type { MfaMethod } from '../../../hooks/use-login-flow';

export interface MfaVerifyStepProps {
    error: string | null;
    isLoading: boolean;
    otp: string;
    trustDevice: boolean;
    selectedMfaMethod: MfaMethod | null;
    availableMfaMethodsCount: number;
    canResend: boolean;
    onOtpChange: (v: string) => void;
    onTrustDeviceChange: (v: boolean) => void;
    onSubmit: () => void | Promise<void>;
    onResend: () => void | Promise<void>;
    onChangeMethod: () => void;
    onCancel: () => void;
}

const mfaLabel = (m: MfaMethod | null) => {
    switch (m) {
        case 'phone':
            return 'SMS';
        case 'totp':
            return 'Authenticator';
        case 'email':
            return 'Email';
        default:
            return '—';
    }
};

export function MfaVerifyStep({
    error,
    isLoading,
    otp,
    trustDevice,
    selectedMfaMethod,
    availableMfaMethodsCount,
    canResend,
    onOtpChange,
    onTrustDeviceChange,
    onSubmit,
    onResend,
    onChangeMethod,
    onCancel,
}: MfaVerifyStepProps) {
    return (
        <>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Method: {mfaLabel(selectedMfaMethod)}
            </Typography>
            <Box
                component="form"
                onSubmit={(e) => {
                    e.preventDefault();
                    void onSubmit();
                }}
                noValidate
            >
                <TextField
                    fullWidth
                    label="Verification code"
                    value={otp}
                    onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
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
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={trustDevice}
                            onChange={(e) => onTrustDeviceChange(e.target.checked)}
                            size="small"
                            disabled={isLoading}
                        />
                    }
                    label="Trust this device"
                    sx={{ mt: 1 }}
                />
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={isLoading || !otp}
                    sx={{ mt: 2, mb: 1, height: 48 }}
                >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Verify'}
                </Button>
                {canResend && (
                    <Button
                        fullWidth
                        variant="text"
                        disabled={isLoading}
                        onClick={() => void onResend()}
                    >
                        Resend code
                    </Button>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    {availableMfaMethodsCount > 1 ? (
                        <Button size="small" onClick={onChangeMethod} disabled={isLoading}>
                            Change method
                        </Button>
                    ) : (
                        <span />
                    )}
                    <Button size="small" onClick={onCancel} disabled={isLoading}>
                        Cancel
                    </Button>
                </Box>
            </Box>
        </>
    );
}
