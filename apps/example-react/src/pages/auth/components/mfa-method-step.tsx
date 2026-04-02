import { Alert, Button, Stack, Typography } from '@mui/material';
import {
    Email as EmailIcon,
    Sms as SmsIcon,
    Smartphone as SmartphoneIcon,
} from '@mui/icons-material';
import type { MfaMethod } from '../../../hooks/use-login-flow';

export interface MfaMethodStepProps {
    error: string | null;
    isLoading: boolean;
    availableMfaMethods: MfaMethod[];
    onSelect: (method: MfaMethod) => void;
    onBack: () => void;
}

const mfaIcon = (m: MfaMethod) => {
    switch (m) {
        case 'phone':
            return <SmsIcon sx={{ mr: 0.5 }} fontSize="small" />;
        case 'totp':
            return <SmartphoneIcon sx={{ mr: 0.5 }} fontSize="small" />;
        default:
            return <EmailIcon sx={{ mr: 0.5 }} fontSize="small" />;
    }
};

const mfaLabel = (m: MfaMethod) => {
    switch (m) {
        case 'phone':
            return 'SMS';
        case 'totp':
            return 'Authenticator';
        default:
            return 'Email';
    }
};

export function MfaMethodStep({
    error,
    isLoading,
    availableMfaMethods,
    onSelect,
    onBack,
}: MfaMethodStepProps) {
    return (
        <>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select a verification method
            </Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
                {availableMfaMethods.map((m) => (
                    <Button
                        key={m}
                        variant="outlined"
                        fullWidth
                        onClick={() => onSelect(m)}
                        disabled={isLoading}
                        sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                        startIcon={mfaIcon(m)}
                    >
                        {mfaLabel(m)}
                    </Button>
                ))}
            </Stack>
            <Button fullWidth onClick={onBack} disabled={isLoading}>
                Back to sign in
            </Button>
        </>
    );
}
