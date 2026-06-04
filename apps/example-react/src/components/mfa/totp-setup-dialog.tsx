import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
} from '@mui/material';
import type { ITotpSetupResponse } from '@ackplus/nest-auth-client';

export type TotpSetupDialogProps = {
    open: boolean;
    onClose: () => void;
    setupData: ITotpSetupResponse | null;
    totpCode: string;
    onTotpCodeChange: (next: string) => void;
    verifying: boolean;
    onVerify: () => void;
};

export function TotpSetupDialog({
    open,
    onClose,
    setupData,
    totpCode,
    onTotpCodeChange,
    verifying,
    onVerify,
}: TotpSetupDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Setup Authenticator App</DialogTitle>
            <DialogContent>
                {setupData && (
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Scan this QR code with your authenticator app
                        </Typography>

                        <Box
                            component="img"
                            src={setupData.qrCode}
                            alt="TOTP QR Code"
                            sx={{
                                width: 200,
                                height: 200,
                                mx: 'auto',
                                mb: 2,
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                            }}
                        />

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Or enter this code manually:
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontFamily: 'monospace',
                                backgroundColor: 'grey.100',
                                p: 1,
                                borderRadius: 1,
                                mb: 3,
                            }}
                        >
                            {setupData.secret}
                        </Typography>

                        <Typography variant="body2" sx={{ mb: 2 }}>
                            Enter the 6-digit code from your app to verify
                        </Typography>
                        <TextField
                            value={totpCode}
                            onChange={(e) => onTotpCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            inputProps={{ maxLength: 6 }}
                            sx={{ width: 220 }}
                        />
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={onVerify}
                    disabled={verifying || totpCode.length !== 6}
                >
                    {verifying ? <CircularProgress size={24} /> : 'Verify'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

