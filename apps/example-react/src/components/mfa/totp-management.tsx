import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useNestAuth } from '@ackplus/nest-auth-react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    FormControlLabel,
    List,
    ListItem,
    ListItemSecondaryAction,
    ListItemText,
    Switch,
    Typography,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Key as KeyIcon } from '@mui/icons-material';
import type { IMfaStatusResponse, ITotpSetupResponse } from '@ackplus/nest-auth-client';
import { TotpSetupDialog } from './totp-setup-dialog';

export function TotpManagement() {
    const { getMfaStatus, toggleMfa, setupTotp, verifyTotpSetup } = useNestAuth();
    const { enqueueSnackbar } = useSnackbar();

    const [loading, setLoading] = useState(true);
    const [mfaStatus, setMfaStatus] = useState<IMfaStatusResponse | null>(null);

    const [setupOpen, setSetupOpen] = useState(false);
    const [setupData, setSetupData] = useState<ITotpSetupResponse | null>(null);
    const [totpCode, setTotpCode] = useState('');
    const [verifyingTotp, setVerifyingTotp] = useState(false);

    const canToggle = useMemo(() => {
        // Some servers use allowUserToggle; contracts also provide canToggle/required.
        if (!mfaStatus) return false;
        if (mfaStatus.required) return false;
        return mfaStatus.canToggle ?? mfaStatus.allowUserToggle ?? false;
    }, [mfaStatus]);

    const fetchMfaStatus = useCallback(async () => {
        setLoading(true);
        try {
            const status = await getMfaStatus();
            setMfaStatus(status);
        } catch (error) {
            console.error('Failed to fetch MFA status:', error);
            enqueueSnackbar('Failed to load MFA settings', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar, getMfaStatus]);

    useEffect(() => {
        void fetchMfaStatus();
    }, [fetchMfaStatus]);

    const handleToggleMfa = useCallback(
        async (enabled: boolean) => {
            try {
                await toggleMfa({ enabled });
                enqueueSnackbar(enabled ? 'MFA enabled!' : 'MFA disabled', { variant: 'success' });
                await fetchMfaStatus();
            } catch (error) {
                console.error('Failed to update MFA settings:', error);
                enqueueSnackbar('Failed to update MFA settings', { variant: 'error' });
            }
        },
        [enqueueSnackbar, fetchMfaStatus, toggleMfa],
    );

    const handleSetupTotp = useCallback(async () => {
        try {
            const data = await setupTotp();
            setSetupData(data);
            setTotpCode('');
            setSetupOpen(true);
        } catch (error) {
            console.error('Failed to start TOTP setup:', error);
            enqueueSnackbar('Failed to start TOTP setup', { variant: 'error' });
        }
    }, [enqueueSnackbar, setupTotp]);

    const handleVerifyTotp = useCallback(async () => {
        if (!setupData) return;
        setVerifyingTotp(true);
        try {
            await verifyTotpSetup({ otp: totpCode, secret: setupData.secret });
            enqueueSnackbar('Authenticator app setup complete!', { variant: 'success' });
            setSetupOpen(false);
            setSetupData(null);
            setTotpCode('');
            await fetchMfaStatus();
        } catch (error) {
            console.error('Failed to verify TOTP setup:', error);
            enqueueSnackbar('Verification failed', { variant: 'error' });
        } finally {
            setVerifyingTotp(false);
        }
    }, [enqueueSnackbar, fetchMfaStatus, setupData, totpCode, verifyTotpSetup]);

    const totpConfiguredCount = mfaStatus?.totpDevices?.length ?? 0;

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Security (MFA)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Enable authenticator app for extra account protection
                </Typography>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <Box sx={{ mb: 3 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={mfaStatus?.isEnabled ?? false}
                                        onChange={(e) => void handleToggleMfa(e.target.checked)}
                                        disabled={!canToggle}
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography>Two-Factor Authentication</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Add an extra layer of security
                                        </Typography>
                                    </Box>
                                }
                            />
                        </Box>

                        {mfaStatus?.isEnabled && (
                            <>
                                <Divider sx={{ my: 3 }} />
                                <Typography variant="subtitle1" gutterBottom>
                                    Authenticator App
                                </Typography>
                                <List>
                                    <ListItem>
                                        <ListItemText
                                            primary="Authenticator App"
                                            secondary={totpConfiguredCount > 0 ? `${totpConfiguredCount} device(s) configured` : 'Not configured'}
                                        />
                                        <ListItemSecondaryAction>
                                            {totpConfiguredCount > 0 ? (
                                                <CheckCircleIcon color="success" />
                                            ) : (
                                                <Button variant="outlined" size="small" onClick={handleSetupTotp}>
                                                    Setup
                                                </Button>
                                            )}
                                        </ListItemSecondaryAction>
                                    </ListItem>

                                    <ListItem>
                                        <ListItemText
                                            primary="Recovery Code"
                                            secondary={mfaStatus?.hasRecoveryCode ? 'Recovery code is set' : 'No recovery code set'}
                                        />
                                        <ListItemSecondaryAction>
                                            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <KeyIcon fontSize="small" />
                                            </Box>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                </List>
                            </>
                        )}
                    </>
                )}

                <TotpSetupDialog
                    open={setupOpen}
                    onClose={() => setSetupOpen(false)}
                    setupData={setupData}
                    totpCode={totpCode}
                    onTotpCodeChange={setTotpCode}
                    verifying={verifyingTotp}
                    onVerify={handleVerifyTotp}
                />
            </CardContent>
        </Card>
    );
}

