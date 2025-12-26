/**
 * Security Page
 * 
 * Security settings with tabs:
 * - Change Password
 * - MFA Settings (Enable/Disable, Setup TOTP, Recovery Codes)
 */

import { useState, useEffect } from 'react';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { useSnackbar } from 'notistack';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Tabs,
    Tab,
    InputAdornment,
    IconButton,
    CircularProgress,
    Alert,
    Switch,
    FormControlLabel,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    Lock as LockIcon,
    Visibility,
    VisibilityOff,
    Security as SecurityIcon,
    Smartphone as SmartphoneIcon,
    Key as KeyIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';

const API_BASE_URL = 'http://localhost:3000';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`security-tabpanel-${index}`}
            aria-labelledby={`security-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export default function SecurityPage() {
    const { user, client } = useNestAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Tab state
    const [tabValue, setTabValue] = useState(0);

    // Change password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // MFA state
    const [mfaStatus, setMfaStatus] = useState<any>(null);
    const [loadingMfa, setLoadingMfa] = useState(true);
    const [setupDialog, setSetupDialog] = useState(false);
    const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
    const [totpCode, setTotpCode] = useState('');
    const [verifyingTotp, setVerifyingTotp] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

    /**
     * Fetch MFA status on mount
     */
    useEffect(() => {
        fetchMfaStatus();
    }, []);

    /**
     * Get auth headers
     */
    const getHeaders = async () => {
        const token = await client.getAccessToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    };

    /**
     * Fetch MFA status
     */
    const fetchMfaStatus = async () => {
        setLoadingMfa(true);
        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/auth/mfa/status`, { headers });

            if (response.ok) {
                const data = await response.json();
                setMfaStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch MFA status:', error);
        } finally {
            setLoadingMfa(false);
        }
    };

    /**
     * Handle password change
     */
    const handleChangePassword = async () => {
        setPasswordError(null);

        // Validation
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters');
            return;
        }

        setChangingPassword(true);
        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to change password');
            }

            enqueueSnackbar('Password changed successfully!', { variant: 'success' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setPasswordError(err.message);
            enqueueSnackbar('Failed to change password', { variant: 'error' });
        } finally {
            setChangingPassword(false);
        }
    };

    /**
     * Toggle MFA
     */
    const handleToggleMfa = async (enabled: boolean) => {
        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/auth/mfa/toggle`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ enabled }),
            });

            if (response.ok) {
                await fetchMfaStatus();
                enqueueSnackbar(
                    enabled ? 'MFA enabled!' : 'MFA disabled',
                    { variant: 'success' }
                );
            }
        } catch (error) {
            enqueueSnackbar('Failed to update MFA settings', { variant: 'error' });
        }
    };

    /**
     * Start TOTP setup
     */
    const handleSetupTotp = async () => {
        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/auth/mfa/setup-totp`, {
                method: 'POST',
                headers,
            });

            if (response.ok) {
                const data = await response.json();
                setSetupData(data);
                setSetupDialog(true);
            }
        } catch (error) {
            enqueueSnackbar('Failed to start TOTP setup', { variant: 'error' });
        }
    };

    /**
     * Verify TOTP setup
     */
    const handleVerifyTotp = async () => {
        setVerifyingTotp(true);
        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/auth/mfa/verify-totp-setup`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ otp: totpCode }),
            });

            if (response.ok) {
                enqueueSnackbar('Authenticator app setup complete!', { variant: 'success' });
                setSetupDialog(false);
                setSetupData(null);
                setTotpCode('');
                await fetchMfaStatus();
            } else {
                const data = await response.json();
                enqueueSnackbar(data.message || 'Invalid code', { variant: 'error' });
            }
        } catch (error) {
            enqueueSnackbar('Verification failed', { variant: 'error' });
        } finally {
            setVerifyingTotp(false);
        }
    };

    /**
     * Generate recovery code
     */
    const handleGenerateRecoveryCode = async () => {
        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/auth/mfa/generate-recovery-code`, {
                method: 'POST',
                headers,
            });

            if (response.ok) {
                const data = await response.json();
                setRecoveryCode(data.code);
                enqueueSnackbar('Recovery code generated!', { variant: 'success' });
                await fetchMfaStatus();
            }
        } catch (error) {
            enqueueSnackbar('Failed to generate recovery code', { variant: 'error' });
        }
    };

    return (
        <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                Security
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Manage your password and two-factor authentication settings
            </Typography>

            <Card>
                <Tabs
                    value={tabValue}
                    onChange={(_, v) => setTabValue(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                >
                    <Tab icon={<LockIcon />} iconPosition="start" label="Password" />
                    <Tab icon={<SecurityIcon />} iconPosition="start" label="Two-Factor Auth" />
                </Tabs>

                <CardContent>
                    {/* Password Tab */}
                    <TabPanel value={tabValue} index={0}>
                        <Typography variant="h6" gutterBottom>
                            Change Password
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Ensure your account stays secure by using a strong password
                        </Typography>

                        {passwordError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {passwordError}
                            </Alert>
                        )}

                        <Box sx={{ maxWidth: 400 }}>
                            <TextField
                                fullWidth
                                label="Current Password"
                                type={showPasswords ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                disabled={changingPassword}
                                margin="normal"
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPasswords(!showPasswords)}
                                                edge="end"
                                            >
                                                {showPasswords ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <TextField
                                fullWidth
                                label="New Password"
                                type={showPasswords ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={changingPassword}
                                margin="normal"
                                helperText="Must be at least 8 characters"
                            />

                            <TextField
                                fullWidth
                                label="Confirm New Password"
                                type={showPasswords ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={changingPassword}
                                margin="normal"
                                error={confirmPassword.length > 0 && newPassword !== confirmPassword}
                                helperText={
                                    confirmPassword.length > 0 && newPassword !== confirmPassword
                                        ? 'Passwords do not match'
                                        : ''
                                }
                            />

                            <Button
                                variant="contained"
                                onClick={handleChangePassword}
                                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                                sx={{ mt: 2 }}
                            >
                                {changingPassword ? <CircularProgress size={24} /> : 'Update Password'}
                            </Button>
                        </Box>
                    </TabPanel>

                    {/* MFA Tab */}
                    <TabPanel value={tabValue} index={1}>
                        {loadingMfa ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <>
                                {/* MFA Toggle */}
                                <Box sx={{ mb: 4 }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={mfaStatus?.isEnabled || false}
                                                onChange={(e) => handleToggleMfa(e.target.checked)}
                                                disabled={!mfaStatus?.allowUserToggle}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography>Two-Factor Authentication</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Add an extra layer of security to your account
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </Box>

                                {mfaStatus?.isEnabled && (
                                    <>
                                        <Divider sx={{ my: 3 }} />

                                        {/* TOTP Setup */}
                                        <Typography variant="h6" gutterBottom>
                                            Authenticator App
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Use an authenticator app like Google Authenticator or Authy
                                        </Typography>

                                        <List>
                                            <ListItem>
                                                <ListItemIcon>
                                                    <SmartphoneIcon />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary="Authenticator App"
                                                    secondary={
                                                        mfaStatus?.totpDevices?.length > 0
                                                            ? `${mfaStatus.totpDevices.length} device(s) configured`
                                                            : 'Not configured'
                                                    }
                                                />
                                                <ListItemSecondaryAction>
                                                    {mfaStatus?.totpDevices?.length > 0 ? (
                                                        <CheckCircleIcon color="success" />
                                                    ) : (
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            onClick={handleSetupTotp}
                                                        >
                                                            Setup
                                                        </Button>
                                                    )}
                                                </ListItemSecondaryAction>
                                            </ListItem>

                                            {/* Recovery Code */}
                                            <ListItem>
                                                <ListItemIcon>
                                                    <KeyIcon />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary="Recovery Code"
                                                    secondary={
                                                        mfaStatus?.hasRecoveryCode
                                                            ? 'Recovery code is set'
                                                            : 'No recovery code set'
                                                    }
                                                />
                                                <ListItemSecondaryAction>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        onClick={handleGenerateRecoveryCode}
                                                    >
                                                        {mfaStatus?.hasRecoveryCode ? 'Regenerate' : 'Generate'}
                                                    </Button>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        </List>

                                        {/* Show recovery code if just generated */}
                                        {recoveryCode && (
                                            <Alert severity="warning" sx={{ mt: 2 }}>
                                                <Typography variant="subtitle2" gutterBottom>
                                                    Save this recovery code securely!
                                                </Typography>
                                                <Typography
                                                    variant="h6"
                                                    sx={{ fontFamily: 'monospace', my: 1 }}
                                                >
                                                    {recoveryCode}
                                                </Typography>
                                                <Typography variant="caption">
                                                    This code will only be shown once. Store it in a safe place.
                                                </Typography>
                                            </Alert>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </TabPanel>
                </CardContent>
            </Card>

            {/* TOTP Setup Dialog */}
            <Dialog open={setupDialog} onClose={() => setSetupDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Setup Authenticator App</DialogTitle>
                <DialogContent>
                    {setupData && (
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Scan this QR code with your authenticator app
                            </Typography>

                            {/* QR Code */}
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
                                Enter the 6-digit code from your app to verify:
                            </Typography>
                            <TextField
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                inputProps={{
                                    maxLength: 6,
                                    style: { textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.5rem' },
                                }}
                                sx={{ width: 200 }}
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSetupDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleVerifyTotp}
                        disabled={verifyingTotp || totpCode.length !== 6}
                    >
                        {verifyingTotp ? <CircularProgress size={24} /> : 'Verify'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
