/**
 * Profile Page
 * 
 * User profile management:
 * - View profile information
 * - Update profile details (name, display name)
 * - Email verification status
 */

import { useState, useEffect, useCallback } from 'react';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { useSnackbar } from 'notistack';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Avatar,
    Grid,
    Divider,
    CircularProgress,
    Alert,
    Chip,
} from '@mui/material';
import {
    Email as EmailIcon,
    Save as SaveIcon,
    Verified as VerifiedIcon,
} from '@mui/icons-material';

import { TotpManagement } from '../components/mfa/totp-management';
import type { ProfileResponse } from '../services/profile.service';
import { profileService } from '../services/profile.service';

/**
 * ProfilePage Component
 * 
 * Allows users to view and update their profile information.
 * Uses the /profile endpoint from the example backend.
 */
export default function ProfilePage() {
    const { sessionData: user } = useNestAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Profile data state
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');

    /**
     * Fetch profile from API
     */
    const fetchProfile = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {


            const data = await profileService.getProfile();
            setProfile(data);

            // Initialize form with fetched data
            setFirstName(data.firstName || '');
            setLastName(data.lastName || '');
            setDisplayName(data.displayName || '');
            setPhone(data.phone || '');

        } catch (err: unknown) {
            console.error('Failed to load profile:', err);
            const maybeError = err as { message?: string };
            setError(maybeError.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Fetch profile data on mount
     */
    useEffect(() => {
        void fetchProfile();
    }, [fetchProfile]);

    /**
     * Save profile changes
     */
    const handleSave = async () => {
        setSaving(true);
        setError(null);

        try {
            const resp = await profileService.updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                displayName: displayName.trim(),
                phone: phone.trim(),
            });
            setProfile(resp.profile);

            enqueueSnackbar('Profile updated successfully!', { variant: 'success' });

        } catch (err: unknown) {
            console.error('Failed to save profile:', err);
            const maybeError = err as { message?: string };
            setError(maybeError.message || 'Failed to save profile');
            enqueueSnackbar('Failed to update profile', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    // Get initials for avatar
    const getInitials = () => {
        if (firstName || lastName) {
            return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        }
        return user?.email?.charAt(0)?.toUpperCase() || '?';
    };

    return (
        <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                Profile
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Manage your personal information
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Profile Card */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <Avatar
                                sx={{
                                    width: 100,
                                    height: 100,
                                    fontSize: '2.5rem',
                                    bgcolor: 'primary.main',
                                    mx: 'auto',
                                    mb: 2,
                                }}
                            >
                                {getInitials()}
                            </Avatar>
                            <Typography variant="h6">
                                {firstName || lastName
                                    ? `${firstName} ${lastName}`.trim()
                                    : 'Set your name'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {user?.email}
                            </Typography>

                            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
                                {profile?.emailVerifiedAt ? (
                                    <Chip
                                        icon={<VerifiedIcon />}
                                        label="Verified"
                                        color="success"
                                        size="small"
                                    />
                                ) : (
                                    <Chip
                                        label="Not Verified"
                                        color="warning"
                                        size="small"
                                    />
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Edit Form Card */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Personal Information
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Update your profile details below
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="First Name"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        disabled={saving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Last Name"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        disabled={saving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        fullWidth
                                        label="Display Name"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        disabled={saving}
                                        helperText="Your public display name"
                                    />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        fullWidth
                                        label="Phone Number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={saving}
                                        helperText="Used for SMS notifications and MFA"
                                    />
                                </Grid>
                            </Grid>

                            <Divider sx={{ my: 3 }} />

                            {/* Email - Read Only */}
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Email Address
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                                <EmailIcon color="action" />
                                <Typography>{user?.email}</Typography>
                                {profile?.emailVerifiedAt && (
                                    <VerifiedIcon color="success" fontSize="small" />
                                )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                Email cannot be changed directly. Contact support if needed.
                            </Typography>

                            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    variant="contained"
                                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* MFA / TOTP Management */}
                <Grid size={12}>
                    <TotpManagement />
                </Grid>
            </Grid>
        </Box>
    );
}
