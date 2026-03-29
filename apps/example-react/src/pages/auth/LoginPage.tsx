/**
 * Login — email, phone, or passwordless OTP, with shared MFA steps.
 */

import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { Box, Link } from '@mui/material';

import AuthCard from '../../components/AuthCard';
import { useAuth } from '../../context/auth-context';
import {
    useLoginFlow,
    type PasswordlessChannel,
    type SetManualError,
} from '../../hooks/use-login-flow';

import { LoginModeTabs, type LoginMode } from './components/login-mode-tabs';
import { EmailPasswordLoginForm } from './components/email-password-login-form';
import { PhonePasswordLoginForm } from './components/phone-password-login-form';
import { PasswordlessLoginPanel } from './components/passwordless-login-panel';
import { MfaMethodStep } from './components/mfa-method-step';
import { MfaVerifyStep } from './components/mfa-verify-step';

export default function LoginPage() {
    const { enqueueSnackbar } = useSnackbar();
    const { isAuthenticated } = useAuth();

    const [mode, setMode] = useState<LoginMode>('email');

    const {
        step,
        selectedMfaMethod,
        availableMfaMethods,
        passwordlessPending,
        isLoading,
        handleEmailLogin,
        handlePhoneLogin,
        handlePasswordlessSend,
        handlePasswordlessVerify,
        handleMfaMethodSelect,
        handleMfaVerify,
        handleMfaResend,
        handleBackToMethod,
        handleBackToLogin,
        clearPasswordlessFlow,
        canResendCode,
    } = useLoginFlow();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    const [pwIdentifier, setPwIdentifier] = useState('');
    const [pwChannel, setPwChannel] = useState<PasswordlessChannel>('email');
    const [pwCode, setPwCode] = useState('');

    const [otp, setOtp] = useState('');
    const [trustDevice, setTrustDevice] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const loginToastShown = useRef(false);

    const setManualError: SetManualError = (_field, opts) => {
        setError(opts.message ?? null);
    };

    useEffect(() => {
        if (!isAuthenticated) {
            loginToastShown.current = false;
            return;
        }
        if (loginToastShown.current) {
            return;
        }
        loginToastShown.current = true;
        enqueueSnackbar(step === 'mfa-verify' ? 'Verification successful!' : 'Welcome back!', {
            variant: 'success',
        });
    }, [isAuthenticated, step, enqueueSnackbar]);

    const handleModeChange = (next: LoginMode) => {
        setMode(next);
        setError(null);
        clearPasswordlessFlow();
        setPwCode('');
    };

    const onEmailSubmit = async () => {
        setError(null);
        await handleEmailLogin(
            { email: email.toLowerCase().trim(), password },
            setManualError,
        );
    };

    const onPhoneSubmit = async () => {
        setError(null);
        await handlePhoneLogin({ phone: phone.trim(), password }, setManualError);
    };

    const onPasswordlessSend = async () => {
        setError(null);
        await handlePasswordlessSend(pwIdentifier, pwChannel, setManualError);
    };

    const onPasswordlessVerify = async () => {
        setError(null);
        await handlePasswordlessVerify(pwCode, setManualError);
    };

    const onMfaSubmit = async () => {
        setError(null);
        await handleMfaVerify({ otp, trustDevice }, setManualError);
    };

    const onPasswordlessBack = () => {
        setError(null);
        setPwCode('');
        clearPasswordlessFlow();
    };

    const tabsDisabled = isLoading;

    if (step === 'mfa-method') {
        return (
            <AuthCard title="Two-factor authentication" subtitle="Choose how to receive your code">
                <MfaMethodStep
                    error={error}
                    isLoading={isLoading}
                    availableMfaMethods={availableMfaMethods}
                    onSelect={(m) => void handleMfaMethodSelect(m)}
                    onBack={handleBackToLogin}
                />
            </AuthCard>
        );
    }

    if (step === 'mfa-verify') {
        return (
            <AuthCard title="Verify your identity" subtitle="Enter the code we sent you">
                <MfaVerifyStep
                    error={error}
                    isLoading={isLoading}
                    otp={otp}
                    trustDevice={trustDevice}
                    selectedMfaMethod={selectedMfaMethod}
                    availableMfaMethodsCount={availableMfaMethods.length}
                    canResend={canResendCode()}
                    onOtpChange={setOtp}
                    onTrustDeviceChange={setTrustDevice}
                    onSubmit={onMfaSubmit}
                    onResend={() => handleMfaResend(setManualError)}
                    onChangeMethod={handleBackToMethod}
                    onCancel={handleBackToLogin}
                />
            </AuthCard>
        );
    }

    if (step === 'passwordless-verify') {
        return (
            <AuthCard title="Enter your code" subtitle="Passwordless sign-in">
                <PasswordlessLoginPanel
                    phase="verify"
                    identifier={passwordlessPending?.identifier ?? ''}
                    channel={passwordlessPending?.channel ?? 'email'}
                    code={pwCode}
                    sentToLabel={passwordlessPending?.identifier}
                    error={error}
                    isLoading={isLoading}
                    onIdentifierChange={setPwIdentifier}
                    onChannelChange={setPwChannel}
                    onCodeChange={setPwCode}
                    onVerify={onPasswordlessVerify}
                    onBack={onPasswordlessBack}
                />
            </AuthCard>
        );
    }

    return (
        <AuthCard title="Sign In" subtitle="Choose how you want to sign in">
            <LoginModeTabs value={mode} onChange={handleModeChange} disabled={tabsDisabled} />

            {mode === 'email' && (
                <EmailPasswordLoginForm
                    email={email}
                    password={password}
                    rememberMe={rememberMe}
                    showPassword={showPassword}
                    error={error}
                    isLoading={isLoading}
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                    onRememberMeChange={setRememberMe}
                    onTogglePassword={() => setShowPassword((s) => !s)}
                    onSubmit={onEmailSubmit}
                />
            )}

            {mode === 'phone' && (
                <PhonePasswordLoginForm
                    phone={phone}
                    password={password}
                    rememberMe={rememberMe}
                    showPassword={showPassword}
                    error={error}
                    isLoading={isLoading}
                    onPhoneChange={setPhone}
                    onPasswordChange={setPassword}
                    onRememberMeChange={setRememberMe}
                    onTogglePassword={() => setShowPassword((s) => !s)}
                    onSubmit={onPhoneSubmit}
                />
            )}

            {mode === 'passwordless' && (
                <PasswordlessLoginPanel
                    phase="send"
                    identifier={pwIdentifier}
                    channel={pwChannel}
                    code={pwCode}
                    error={error}
                    isLoading={isLoading}
                    onIdentifierChange={setPwIdentifier}
                    onChannelChange={setPwChannel}
                    onCodeChange={setPwCode}
                    onSend={onPasswordlessSend}
                    onVerify={onPasswordlessVerify}
                    onBack={onPasswordlessBack}
                />
            )}

            <Box sx={{ textAlign: 'center', mt: 1 }}>
                <Link component={RouterLink} to="/signup" variant="body2" sx={{ textDecoration: 'none' }}>
                    Don&apos;t have an account? Sign up
                </Link>
            </Box>
        </AuthCard>
    );
}
