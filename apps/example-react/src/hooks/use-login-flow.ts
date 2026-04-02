import { useCallback, useState } from 'react';
import type { IVerify2faRequest } from '@ackplus/nest-auth-client';
import { useAuth } from '../context/auth-context';

/** Aligns with `IPasswordlessSendRequest` / server passwordless send. */
export type PasswordlessChannel = 'email' | 'sms';
import { errorMessage } from '../utils/error-message';

export type LoginStep = 'login' | 'passwordless-verify' | 'mfa-method' | 'mfa-verify';

export type MfaMethod = 'email' | 'phone' | 'totp';

export type LoginCredentialsValues =
    | { mode: 'email'; email: string; password: string }
    | { mode: 'phone'; phone: string; password: string }
    | { mode: 'passwordless'; identifier: string };

export interface MfaOtpFormValues {
    otp: string;
    trustDevice?: boolean;
}

export interface PasswordlessPending {
    identifier: string;
    channel: PasswordlessChannel;
}

export interface LoginFlowState {
    step: LoginStep;
    selectedMfaMethod: MfaMethod | null;
    availableMfaMethods: MfaMethod[];
    defaultMfaMethod: MfaMethod | null;
    loginCredentials: LoginCredentialsValues | null;
    passwordlessPending: PasswordlessPending | null;
    isLoading: boolean;
}

/** Compatible with `react-hook-form` `setError` signature used in larger apps. */
export type SetManualError = (
    field: 'afterSubmit' | 'root' | string,
    opts: { type?: string; message?: string },
) => void;

export interface LoginFlowActions {
    handleEmailLogin: (values: { email: string; password: string }, setError: SetManualError) => Promise<void>;
    handlePhoneLogin: (values: { phone: string; password: string }, setError: SetManualError) => Promise<void>;
    handlePasswordlessSend: (
        identifier: string,
        channel: PasswordlessChannel,
        setError: SetManualError,
    ) => Promise<void>;
    handlePasswordlessVerify: (code: string, setError: SetManualError) => Promise<void>;
    handleMfaMethodSelect: (method: MfaMethod) => Promise<void>;
    handleMfaVerify: (values: MfaOtpFormValues, setError: SetManualError) => Promise<void>;
    handleMfaResend: (setError: SetManualError) => Promise<void>;
    handleBackToMethod: () => void;
    handleBackToLogin: () => void;
    clearPasswordlessFlow: () => void;
    canResendCode: () => boolean;
}

const mapMfaMethod = (method: string): MfaMethod => {
    switch (method?.toLowerCase()) {
        case 'email':
            return 'email';
        case 'sms':
        case 'phone':
            return 'phone';
        case 'totp':
            return 'totp';
        default:
            return 'email';
    }
};

const mapToSend2faMethod = (method: MfaMethod): 'email' | 'phone' => {
    switch (method) {
        case 'phone':
            return 'phone';
        case 'email':
        case 'totp':
        default:
            return 'email';
    }
};

/** Values align with server `NestAuthMFAMethodEnum` (`email` | `sms` | `totp`). */
const mapToVerify2faMethod = (method: MfaMethod): 'email' | 'sms' | 'totp' => {
    switch (method) {
        case 'phone':
            return 'sms';
        case 'totp':
            return 'totp';
        case 'email':
        default:
            return 'email';
    }
};

/**
 * Email / phone / passwordless OTP login with MFA steps when required.
 */
export function useLoginFlow(): LoginFlowState & LoginFlowActions {
    const { login, client, send2fa, passwordlessSend } = useAuth();

    const [step, setStep] = useState<LoginStep>('login');
    const [selectedMfaMethod, setSelectedMfaMethod] = useState<MfaMethod | null>(null);
    const [availableMfaMethods, setAvailableMfaMethods] = useState<MfaMethod[]>([]);
    const [defaultMfaMethod, setDefaultMfaMethod] = useState<MfaMethod | null>(null);
    const [loginCredentials, setLoginCredentials] = useState<LoginCredentialsValues | null>(null);
    const [passwordlessPending, setPasswordlessPending] = useState<PasswordlessPending | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const canResendCode = useCallback(() => {
        return selectedMfaMethod !== 'totp';
    }, [selectedMfaMethod]);

    const sendCodeForMethod = useCallback(
        async (method: MfaMethod) => {
            if (method === 'totp') {
                return;
            }
            try {
                await send2fa(mapToSend2faMethod(method));
            } catch {
                /* code may already be sent */
            }
        },
        [send2fa],
    );

    const processMfaRequired = useCallback(
        async (
            mfaMethods: string[],
            defaultMethod: string | null | undefined,
            credentials: LoginCredentialsValues,
        ) => {
            setLoginCredentials(credentials);

            const methods = mfaMethods.map(mapMfaMethod);
            setAvailableMfaMethods(methods);

            const mappedDefault = defaultMethod ? mapMfaMethod(String(defaultMethod)) : null;
            setDefaultMfaMethod(mappedDefault);

            if (mappedDefault && methods.includes(mappedDefault)) {
                setSelectedMfaMethod(mappedDefault);
                await sendCodeForMethod(mappedDefault);
                setStep('mfa-verify');
            } else if (methods.length === 1) {
                setSelectedMfaMethod(methods[0]);
                await sendCodeForMethod(methods[0]);
                setStep('mfa-verify');
            } else {
                setStep('mfa-method');
            }
        },
        [sendCodeForMethod],
    );

    const runAuthResponse = useCallback(
        async (
            response: { isRequiresMfa?: boolean; mfaMethods?: unknown[]; defaultMfaMethod?: unknown } | undefined,
            credentials: LoginCredentialsValues,
        ) => {
            if (response?.isRequiresMfa) {
                await processMfaRequired(
                    Array.isArray(response.mfaMethods) ? response.mfaMethods.map(String) : [],
                    response.defaultMfaMethod != null ? String(response.defaultMfaMethod) : undefined,
                    credentials,
                );
            }
        },
        [processMfaRequired],
    );

    const handleEmailLogin = useCallback(
        async (values: { email: string; password: string }, setError: SetManualError) => {
            setIsLoading(true);
            const creds: LoginCredentialsValues = {
                mode: 'email',
                email: values.email.toLowerCase().trim(),
                password: values.password,
            };
            try {
                const response = await login({
                    providerName: 'email',
                    credentials: {
                        email: creds.email,
                        password: creds.password,
                    },
                });
                await runAuthResponse(response, creds);
            } catch (error: unknown) {
                const errData =
                    error && typeof error === 'object'
                        ? ((error as Record<string, unknown>).response as Record<string, unknown> | undefined)?.data ??
                          (error as Record<string, unknown>).data
                        : undefined;
                const data = errData && typeof errData === 'object' ? (errData as Record<string, unknown>) : undefined;

                if (data?.isRequiresMfa) {
                    await processMfaRequired(
                        Array.isArray(data.mfaMethods) ? data.mfaMethods.map(String) : [],
                        data.defaultMfaMethod != null ? String(data.defaultMfaMethod) : undefined,
                        creds,
                    );
                } else {
                    setError('afterSubmit', {
                        type: 'manual',
                        message: errorMessage(error),
                    });
                }
            } finally {
                setIsLoading(false);
            }
        },
        [login, processMfaRequired, runAuthResponse],
    );

    const handlePhoneLogin = useCallback(
        async (values: { phone: string; password: string }, setError: SetManualError) => {
            setIsLoading(true);
            const creds: LoginCredentialsValues = {
                mode: 'phone',
                phone: values.phone.trim(),
                password: values.password,
            };
            try {
                const response = await login({
                    providerName: 'phone',
                    credentials: {
                        phone: creds.phone,
                        password: creds.password,
                    },
                });
                await runAuthResponse(response, creds);
            } catch (error: unknown) {
                const errData =
                    error && typeof error === 'object'
                        ? ((error as Record<string, unknown>).response as Record<string, unknown> | undefined)?.data ??
                          (error as Record<string, unknown>).data
                        : undefined;
                const data = errData && typeof errData === 'object' ? (errData as Record<string, unknown>) : undefined;

                if (data?.isRequiresMfa) {
                    await processMfaRequired(
                        Array.isArray(data.mfaMethods) ? data.mfaMethods.map(String) : [],
                        data.defaultMfaMethod != null ? String(data.defaultMfaMethod) : undefined,
                        creds,
                    );
                } else {
                    setError('afterSubmit', {
                        type: 'manual',
                        message: errorMessage(error),
                    });
                }
            } finally {
                setIsLoading(false);
            }
        },
        [login, processMfaRequired, runAuthResponse],
    );

    const handlePasswordlessSend = useCallback(
        async (identifier: string, channel: PasswordlessChannel, setError: SetManualError) => {
            const trimmed = identifier.trim();
            if (!trimmed) {
                setError('afterSubmit', { type: 'manual', message: 'Enter an email or phone number.' });
                return;
            }
            setIsLoading(true);
            try {
                await passwordlessSend({ identifier: trimmed, channel });
                setPasswordlessPending({ identifier: trimmed, channel });
                setStep('passwordless-verify');
            } catch (error: unknown) {
                setError('afterSubmit', {
                    type: 'manual',
                    message: errorMessage(error),
                });
            } finally {
                setIsLoading(false);
            }
        },
        [passwordlessSend],
    );

    const handlePasswordlessVerify = useCallback(
        async (code: string, setError: SetManualError) => {
            if (!passwordlessPending) {
                setError('root', { type: 'manual', message: 'Request a code first.' });
                return;
            }
            setIsLoading(true);
            const creds: LoginCredentialsValues = {
                mode: 'passwordless',
                identifier: passwordlessPending.identifier,
            };
            try {
                const response = await login({
                    providerName: 'passwordless',
                    credentials: {
                        identifier: passwordlessPending.identifier,
                        channels: [passwordlessPending.channel],
                        code: code.trim(),
                    },
                });
                if (response?.isRequiresMfa) {
                    await processMfaRequired(
                        (response.mfaMethods ?? []).map(String),
                        response.defaultMfaMethod != null ? String(response.defaultMfaMethod) : undefined,
                        creds,
                    );
                }
            } catch (error: unknown) {
                const errData =
                    error && typeof error === 'object'
                        ? ((error as Record<string, unknown>).response as Record<string, unknown> | undefined)?.data ??
                          (error as Record<string, unknown>).data
                        : undefined;
                const data = errData && typeof errData === 'object' ? (errData as Record<string, unknown>) : undefined;

                if (data?.isRequiresMfa) {
                    await processMfaRequired(
                        Array.isArray(data.mfaMethods) ? data.mfaMethods.map(String) : [],
                        data.defaultMfaMethod != null ? String(data.defaultMfaMethod) : undefined,
                        creds,
                    );
                } else {
                    setError('root', {
                        type: 'manual',
                        message: errorMessage(error),
                    });
                }
            } finally {
                setIsLoading(false);
            }
        },
        [login, passwordlessPending, processMfaRequired],
    );

    const handleMfaMethodSelect = useCallback(
        async (method: MfaMethod) => {
            setSelectedMfaMethod(method);
            setIsLoading(true);
            try {
                await sendCodeForMethod(method);
                setStep('mfa-verify');
            } finally {
                setIsLoading(false);
            }
        },
        [sendCodeForMethod],
    );

    const handleMfaVerify = useCallback(
        async (values: MfaOtpFormValues, setError: SetManualError) => {
            if (!selectedMfaMethod) {
                setError('root', { type: 'manual', message: 'No MFA method selected.' });
                return;
            }
            setIsLoading(true);
            try {
                await client.verify2fa({
                    otp: values.otp.trim(),
                    method: mapToVerify2faMethod(selectedMfaMethod) as NonNullable<IVerify2faRequest['method']>,
                    trustDevice: values.trustDevice,
                });
            } catch (error: unknown) {
                setError('root', {
                    type: 'manual',
                    message: errorMessage(error),
                });
            } finally {
                setIsLoading(false);
            }
        },
        [client, selectedMfaMethod],
    );

    const handleMfaResend = useCallback(
        async (setError: SetManualError) => {
            if (!canResendCode() || !selectedMfaMethod) {
                return;
            }
            setIsLoading(true);
            try {
                await send2fa(mapToSend2faMethod(selectedMfaMethod));
            } catch (error: unknown) {
                setError('root', {
                    type: 'manual',
                    message: errorMessage(error),
                });
            } finally {
                setIsLoading(false);
            }
        },
        [canResendCode, selectedMfaMethod, send2fa],
    );

    const handleBackToMethod = useCallback(() => {
        setStep('mfa-method');
    }, []);

    const clearPasswordlessFlow = useCallback(() => {
        setPasswordlessPending(null);
        if (step === 'passwordless-verify') {
            setStep('login');
        }
    }, [step]);

    const handleBackToLogin = useCallback(() => {
        setStep('login');
        setSelectedMfaMethod(null);
        setLoginCredentials(null);
        setAvailableMfaMethods([]);
        setDefaultMfaMethod(null);
        setPasswordlessPending(null);
    }, []);

    return {
        step,
        selectedMfaMethod,
        availableMfaMethods,
        defaultMfaMethod,
        loginCredentials,
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
    };
}

export default useLoginFlow;
