import React from 'react';
import {
    Mail,
    Smartphone,
    KeyRound,
    Shield,
    Github,
    Chrome,
    Lock,
    Link2,
} from 'lucide-react';
import {
    Alert,
    Box,
    Chip,
    Divider,
    Icon,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import type { UserDetails } from '../../types';

export interface UserLoginCapabilitiesDisplayProps {
    loginCapabilities?: UserDetails['loginCapabilities'];
    mfa?: UserDetails['mfa'];
}

type LoginMethod = {
    key: string;
    label: string;
    icon: React.ReactElement;
    helper?: string;
};

function getProviderIcon(provider: string) {
    switch (provider) {
        case 'github':
            return <Icon component={Github} fontSize="small" />;
        case 'google':
        case 'facebook':
        case 'apple':
        default:
            return <Icon component={Chrome} fontSize="small" />;
    }
}

function formatProviderName(provider: string) {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export const UserLoginCapabilitiesDisplay: React.FC<UserLoginCapabilitiesDisplayProps> = ({
    loginCapabilities,
    mfa,
}) => {
    const email = loginCapabilities?.email;
    const phone = loginCapabilities?.phone;
    const passwordless = loginCapabilities?.passwordless;
    const social = loginCapabilities?.social;
    const mfaCapabilities = loginCapabilities?.mfa;

    const loginMethods: LoginMethod[] = [];

    if (email?.canPasswordLogin) {
        loginMethods.push({
            key: 'email-password',
            label: 'Email + Password',
            icon: <Icon component={Mail} fontSize="small" />,
            helper: 'User can sign in with email and password.',
        });
    }

    if (email?.canOtpLogin) {
        loginMethods.push({
            key: 'email-otp',
            label: 'Email + OTP',
            icon: <Icon component={Mail} fontSize="small" />,
            helper: 'User can sign in with a one-time code sent to email.',
        });
    }

    if (phone?.canOtpLogin) {
        loginMethods.push({
            key: 'phone-otp',
            label: 'Phone + OTP',
            icon: <Icon component={Smartphone} fontSize="small" />,
            helper: 'User can sign in with a one-time code sent to phone.',
        });
    }

    (social?.identityProviders ?? []).forEach((provider) => {
        loginMethods.push({
            key: `social-${provider}`,
            label: `${formatProviderName(provider)} Sign In`,
            icon: getProviderIcon(provider),
            helper: `User has ${formatProviderName(provider)} linked and can sign in with it.`,
        });
    });

    const hasAnyLoginMethod = loginMethods.length > 0;

    const emailStatusText = !email?.enabledInConfig
        ? 'Disabled in configuration'
        : !email?.hasIdentity
            ? 'No email identity'
            : email?.canPasswordLogin || email?.canOtpLogin
                ? 'Available for login'
                : 'Not available for login';

    const phoneStatusText = !phone?.enabledInConfig
        ? 'Disabled in configuration'
        : !phone?.hasIdentity
            ? 'No phone identity'
            : phone?.canOtpLogin
                ? 'Available for login'
                : 'Not available for login';

    const mfaRequired =
        !!mfaCapabilities?.enabledInConfig &&
        (mfaCapabilities?.requiredForAll || mfaCapabilities?.requiredForUser);

    return (
        <Stack spacing={2}>
            <Paper variant="outlined">
                <Box p={2}>
                    <Stack spacing={1.5}>
                        <Box>
                            <Typography variant="subtitle2">Can this user sign in?</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Final login methods available for this user.
                            </Typography>
                        </Box>

                        {hasAnyLoginMethod ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {loginMethods.map((method) => (
                                    <Chip
                                        key={method.key}
                                        color="success"
                                        variant="filled"
                                        icon={method.icon}
                                        label={method.label}
                                    />
                                ))}
                            </Stack>
                        ) : (
                            <Alert severity="warning" variant="outlined">
                                This user cannot sign in right now. No active login method is available.
                            </Alert>
                        )}
                    </Stack>
                </Box>
            </Paper>

            <Paper variant="outlined">
                <Box p={2}>
                    <Stack spacing={1.5}>
                        <Box>
                            <Typography variant="subtitle2">Identifiers</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Whether email or phone is available and usable for sign in.
                            </Typography>
                        </Box>

                        <List disablePadding>
                            <ListItem disableGutters>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Icon component={Mail} fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Email"
                                    secondary={
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                            <Chip
                                                size="small"
                                                label={emailStatusText}
                                                color={email?.canPasswordLogin || email?.canOtpLogin ? 'success' : 'default'}
                                                variant={email?.canPasswordLogin || email?.canOtpLogin ? 'filled' : 'outlined'}
                                            />
                                            {email?.hasIdentity && (
                                                <Chip
                                                    size="small"
                                                    label={email?.verified ? 'Verified' : 'Not verified'}
                                                    color={email?.verified ? 'success' : 'warning'}
                                                    variant="outlined"
                                                />
                                            )}
                                        </Stack>
                                    }
                                />
                            </ListItem>

                            <Divider component="li" />

                            <ListItem disableGutters>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Icon component={Smartphone} fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Phone"
                                    secondary={
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                            <Chip
                                                size="small"
                                                label={phoneStatusText}
                                                color={phone?.canOtpLogin ? 'success' : 'default'}
                                                variant={phone?.canOtpLogin ? 'filled' : 'outlined'}
                                            />
                                            {phone?.hasIdentity && (
                                                <Chip
                                                    size="small"
                                                    label={phone?.verified ? 'Verified' : 'Not verified'}
                                                    color={phone?.verified ? 'success' : 'warning'}
                                                    variant="outlined"
                                                />
                                            )}
                                        </Stack>
                                    }
                                />
                            </ListItem>
                        </List>
                    </Stack>
                </Box>
            </Paper>

            <Paper variant="outlined">
                <Box p={2}>
                    <Stack spacing={1.5}>
                        <Box>
                            <Typography variant="subtitle2">Social sign in</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Providers enabled in config and providers actually linked to this user.
                            </Typography>
                        </Box>

                        {(social?.enabledProviders?.length || social?.identityProviders?.length) ? (
                            <Stack spacing={1}>
                                {!!social?.enabledProviders?.length && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Enabled providers
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                            {social.enabledProviders.map((provider) => (
                                                <Chip
                                                    key={`enabled-${provider}`}
                                                    size="small"
                                                    variant="outlined"
                                                    icon={getProviderIcon(provider)}
                                                    label={formatProviderName(provider)}
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                )}

                                {!!social?.identityProviders?.length && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Linked providers
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                            {social.identityProviders.map((provider) => (
                                                <Chip
                                                    key={`linked-${provider}`}
                                                    size="small"
                                                    color="success"
                                                    variant="filled"
                                                    icon={getProviderIcon(provider)}
                                                    label={`${formatProviderName(provider)} linked`}
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                            </Stack>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                No social sign-in is available for this user.
                            </Typography>
                        )}
                    </Stack>
                </Box>
            </Paper>

            <Paper variant="outlined">
                <Box p={2}>
                    <Stack spacing={1.5}>
                        <Box>
                            <Typography variant="subtitle2">Extra verification after sign in</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Multi-factor authentication requirement for this user.
                            </Typography>
                        </Box>

                        {!mfaCapabilities?.enabledInConfig ? (
                            <Chip size="small" label="MFA disabled in configuration" variant="outlined" />
                        ) : (
                            <Stack spacing={1}>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Chip
                                        size="small"
                                        icon={<Icon component={Shield} fontSize="small" />}
                                        label={
                                            mfaRequired
                                                ? 'MFA required after login'
                                                : 'MFA available but not required'
                                        }
                                        color={mfaRequired ? 'warning' : 'default'}
                                        variant={mfaRequired ? 'filled' : 'outlined'}
                                    />

                                    {mfa?.isEnabled && (
                                        <Chip
                                            size="small"
                                            icon={<Icon component={Lock} fontSize="small" />}
                                            label="User has MFA enabled"
                                            color="success"
                                            variant="outlined"
                                        />
                                    )}
                                </Stack>

                                {!!mfa?.enabledMethods?.length && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Enabled methods
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                            {mfa.enabledMethods.map((method) => (
                                                <Chip
                                                    key={method}
                                                    size="small"
                                                    label={method.toUpperCase()}
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                )}

                                {!!mfa?.availableMethods?.length && !mfa?.enabledMethods?.length && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Available methods
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                            {mfa.availableMethods.map((method) => (
                                                <Chip
                                                    key={method}
                                                    size="small"
                                                    label={method.toUpperCase()}
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                            </Stack>
                        )}
                    </Stack>
                </Box>
            </Paper>

            <Paper variant="outlined">
                <Box p={2}>
                    <Stack spacing={1}>
                        <Typography variant="subtitle2">Summary</Typography>

                        {hasAnyLoginMethod ? (
                            <List disablePadding>
                                {loginMethods.map((method) => (
                                    <ListItem key={method.key} disableGutters>
                                        <ListItemIcon sx={{ minWidth: 32 }}>{method.icon}</ListItemIcon>
                                        <ListItemText
                                            primary={method.label}
                                            secondary={
                                                mfaRequired
                                                    ? `${method.helper} MFA will be requested after successful login.`
                                                    : method.helper
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                This user does not currently have any working login method.
                            </Typography>
                        )}
                    </Stack>
                </Box>
            </Paper>
        </Stack>
    );
};