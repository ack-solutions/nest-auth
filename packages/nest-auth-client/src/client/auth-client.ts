/**
 * Core AuthClient class
 * Framework-agnostic authentication client
 */

import {
    ITokenPair,
    ISignupRequest,
    IRefreshRequest,
    IForgotPasswordRequest,
    IResetPasswordWithTokenRequest,
    IVerifyEmailRequest,
    IVerifyForgotPasswordOtpRequest,
    ISendEmailVerificationRequest,
    ISendPhoneVerificationRequest,
    IVerifyPhoneRequest,
    IChangePasswordRequest,
    IVerify2faRequest,
    IAuthResponse,
    IMessageResponse,
    IVerifyOtpResponse,
    IVerify2faResponse,
    ITotpSetupResponse,
    IVerifyTotpSetupRequest,
    IMfaStatusResponse,
    IMfaDevice,
    IToggleMfaRequest,
    ISwitchTenantRequest,
    INestAuthUserAccess,
    IPasswordlessSendRequest,
    IPasswordlessLoginRequest,
    NEST_AUTH_PASSWORDLESS_PROVIDER,
    ISessionUserData,
    ILoginRequest,
    IClientConfig,
} from '@ackplus/nest-auth-contracts';
import {
    AuthClientConfig,
    HttpResponse,
    RequestOptions,
    GetAuthHeadersOptions,
    DEFAULT_ENDPOINTS,
} from '../types/config.types';
import { ClientSession, TokenState } from '../types/auth.types';
import { AuthError } from '../types/auth.types';
import { LocalStorageAdapter } from '../storage/local.storage';
import { FetchAdapter } from '../http/fetch.adapter';
import { TokenManager } from '../token/token-manager';
import { decodeJwt, getUserIdFromToken } from '../token/jwt-utils';
import { EventEmitter, AuthEvents } from './event-emitter';
import { RefreshQueue, RetryTracker } from './refresh-queue';
import {
    attachToAxios,
    attachToFetch,
    type AxiosLikeInstance,
    type AttachOptions,
} from './http-attach';

/** Storage keys */
const STORAGE_KEYS = {
    SESSION: 'session',
};

/**
 * Main authentication client
 * 
 * @example
 * ```typescript
 * import { AuthClient } from '@ackplus/nest-auth-client';
 * 
 * const client = new AuthClient({
 *   baseUrl: 'http://localhost:3000',
 *   accessTokenType: 'header',
 * });
 * 
 * // Login
 * const response = await client.login({
 *   credentials: { email: 'user@example.com', password: 'password' }
 * });
 * 
 * // Get current user
 * const user = await client.me();
 * ```
 */
export class AuthClient {
    private config: Required<Pick<AuthClientConfig, 'baseUrl'>> & AuthClientConfig;
    private tokenManager: TokenManager;
    private events: EventEmitter<AuthEvents>;
    private refreshQueue: RefreshQueue;
    private retryTracker: RetryTracker;
    private isAuthenticated: boolean = false;

    private session: ClientSession | null = null;

    private tenantId: string | undefined;

    private timeout: number = 30000;

    constructor(config: AuthClientConfig) {
        // Apply defaults
        this.config = {
            ...config,
            endpoints: { ...DEFAULT_ENDPOINTS, ...config.endpoints },
            accessTokenType: config.accessTokenType ?? null,
            storage: config.storage ?? new LocalStorageAdapter(),
            httpAdapter: config.httpAdapter ?? new FetchAdapter(),
            autoRefresh: config.autoRefresh ?? true,
            refreshThreshold: config.refreshThreshold ?? 60,
        };

        // Active tenant is set from token/session after login or from loadPersistedState; use config.defaultTenantId only as fallback

        // Initialize token manager
        this.tokenManager = new TokenManager({
            storage: this.config.storage!,
            accessTokenType: this.config.accessTokenType!,
            refreshThreshold: this.config.refreshThreshold,
            logger: this.config.logger,
        });

        // Initialize utilities
        this.events = new EventEmitter<AuthEvents>();
        this.refreshQueue = new RefreshQueue();
        this.retryTracker = new RetryTracker();

        // Load persisted state and emit tokensSet event if tokens are restored
        this.loadPersistedState().then(() => {
            // After loading persisted state, check if tokens exist and emit tokensSet event
            // This ensures onTokensSet callback is called when tokens are restored from storage
            this.emitTokensSetIfRestored();
        }).catch((error) => {
            this.log('warn', 'Failed to load persisted state', error);
        });
    }

    // ============================================================================
    // Internal helpers
    // ============================================================================

    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
        if (this.config.logger?.[level]) {
            this.config.logger[level](message, ...args);
        }
    }

    private async loadPersistedState(): Promise<void> {
        try {
            const sessionJson = await Promise.resolve(this.config.storage!.get(STORAGE_KEYS.SESSION));
            if (sessionJson) {
                this.session = JSON.parse(sessionJson);
                this.tenantId = this.session?.tenantId ?? undefined;
            }
        } catch (error) {
            this.log('warn', 'Failed to load persisted auth state', error);
        }
    }

    /**
     * Emit tokensSet event if tokens were restored from storage
     * This ensures onTokensSet callback is called when tokens are restored on app reload
     */
    private async emitTokensSetIfRestored(): Promise<void> {
        try {
            // Only emit in header mode (in cookie mode, tokens are managed by server)
            if (!this.tokenManager.isHeaderMode()) {
                return;
            }

            // Check if tokens exist in storage
            const tokens = await this.tokenManager.getTokens();
            if (tokens && tokens.accessToken && tokens.refreshToken) {
                const trustToken = await this.tokenManager.getTrustToken();

                this.log('debug', 'emitTokensSetIfRestored: Tokens found in storage, emitting tokensSet event', {
                    hasAccessToken: !!tokens.accessToken,
                    hasRefreshToken: !!tokens.refreshToken,
                    hasTrustToken: !!trustToken,
                });

                // Emit tokensSet event to notify listeners (e.g., AuthProvider's onTokensSet callback)
                // This ensures global HTTP clients (like Axios) can sync their headers on app reload
                await this.events.emitAsync('tokensSet', {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    trustToken: trustToken || undefined,
                });

                this.log('debug', 'emitTokensSetIfRestored: tokensSet event emitted successfully');
            } else {
                this.log('debug', 'emitTokensSetIfRestored: No tokens found in storage');
            }
        } catch (error) {
            this.log('warn', 'emitTokensSetIfRestored: Failed to emit tokensSet event', error);
        }
    }

    private async persistState(): Promise<void> {
        try {
            if (this.session) {
                await Promise.resolve(this.config.storage!.set(STORAGE_KEYS.SESSION, JSON.stringify(this.session)));
            } else {
                await Promise.resolve(this.config.storage!.remove(STORAGE_KEYS.SESSION));
            }
        } catch (error) {
            this.log('warn', 'Failed to persist auth state', error);
        }
    }

    private buildUrl(endpoint: string): string {
        const base = this.config.baseUrl.replace(/\/$/, '');
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${path}`;
    }

    private getEndpoint(key: keyof typeof DEFAULT_ENDPOINTS): string {
        return (this.config.endpoints as Record<string, string>)[key] || DEFAULT_ENDPOINTS[key];
    }


    private getTenantIdValue(): string | undefined {
        return this.tenantId;
    }

    private async buildHeaders(options?: RequestOptions): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options?.headers,
        };

        // Add access token type header to communicate preferred mode to backend
        const mode = this.tokenManager.getMode();
        if (mode) {
            headers['x-access-token-type'] = mode;
            this.log('debug', 'buildHeaders: Mode', mode);
        }

        // Add authorization header if in header mode
        if (this.tokenManager.isHeaderMode() && !options?.skipAuthHeader) {
            const authHeader = await this.tokenManager.getAuthorizationHeader();
            if (authHeader) {
                headers['Authorization'] = authHeader;
                this.log('debug', 'buildHeaders: Authorization header added');
            } else {
                this.log('debug', 'buildHeaders: No auth header returned');
            }

        } else {
            this.log('debug', 'buildHeaders: Cookie mode - skipping Authorization header');
        }

        // Add trust token header if in header mode (for trusted device verification)
        // In cookie mode, trust token is automatically sent via cookies
        if (this.tokenManager.isHeaderMode()) {
            const trustToken = await this.tokenManager.getTrustToken();
            if (trustToken) {
                // Use configurable header name or default
                const trustHeaderName = this.config.trustDeviceHeaderName || 'nest_auth_device_trust';
                headers[trustHeaderName] = trustToken;
                this.log('debug', 'buildHeaders: Trust token header added', { headerName: trustHeaderName });
            }
        }

        return headers;
    }

    private async request<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        endpoint: string,
        body?: any,
        options?: RequestOptions
    ): Promise<HttpResponse<T>> {
        const url = this.buildUrl(endpoint);
        const headers = await this.buildHeaders(options);
        const requestId = this.retryTracker.createRequestId(method, url);

        this.log('debug', 'AuthClient.request', {
            url,
            method,
            headers: Object.keys(headers),
            requestId,
            isCookie: this.tokenManager.isCookieMode(),
        });

        const makeRequest = async (): Promise<HttpResponse<T>> => {
            return this.config.httpAdapter!.request<T>({
                url,
                method,
                headers,
                body,
                credentials: this.tokenManager.isCookieMode() ? 'include' : 'same-origin',
                timeout: options?.timeout ?? this.timeout,
                signal: options?.signal,
            });
        };
        let response: HttpResponse<T>;
        try {
            response = await makeRequest();
        } catch (error) {
            // Network error / adapter threw: return a consistent response shape
            // so callers don't crash on `response.status`.
            this.log('warn', 'AuthClient.request: HTTP adapter threw', { url, method, error });
            response = {
                status: 0,
                ok: false,
                data: null as any,
                headers: {},
            };
        }

        // Handle 401 with token refresh
        if (
            response.status === 401 &&
            !options?.skipRefresh &&
            !this.retryTracker.hasRetried(requestId) &&
            this.config.autoRefresh
        ) {
            this.log('debug', '401 received, attempting token refresh');

            try {
                // Mark this request as retried
                this.retryTracker.markRetried(requestId);

                // Refresh tokens
                await this.refresh();

                // Retry the original request with new token
                const newHeaders = await this.buildHeaders(options);
                response = await this.config.httpAdapter!.request<T>({
                    url,
                    method,
                    headers: newHeaders,
                    body,
                    credentials: this.tokenManager.isCookieMode() ? 'include' : 'same-origin',
                    timeout: options?.timeout ?? this.timeout,
                    signal: options?.signal,
                });
            } catch (refreshError) {
                this.log('debug', 'Token refresh failed', refreshError);
                // If refresh fails, return the original 401 response
            }
        }

        return response;
    }

    private handleError(response: HttpResponse<any>): AuthError {
        const error: AuthError = {
            message: response.data?.message || 'An error occurred',
            code: response.data?.code || response.data?.error,
            statusCode: response.status,
            details: response.data,
        };

        this.events.emit('error', error);
        this.config.onError?.(error);

        return error;
    }

    /**
     * Store tokens only (without setting authenticated state)
     * Used for MFA flow where tokens are needed but user is not yet authenticated
     */
    private async storeTokensOnly(tokens: { accessToken?: string; refreshToken?: string; trustToken?: string }): Promise<void> {
        if (tokens.accessToken && tokens.refreshToken) {
            this.log('debug', 'storeTokensOnly: Storing tokens for MFA flow', {
                hasAccessToken: !!tokens.accessToken,
                hasRefreshToken: !!tokens.refreshToken,
                hasTrustToken: !!tokens.trustToken,
                mode: this.tokenManager.getMode(),
            });
            await this.tokenManager.setTokens({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });

            // Store trust token if present
            if (tokens.trustToken) {
                await this.tokenManager.setTrustToken(tokens.trustToken);
            }

            // Emit tokensSet event and wait for all listeners (include trust token if present)
            await this.events.emitAsync('tokensSet', {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                trustToken: tokens.trustToken || undefined,
            });
            this.log('debug', 'storeTokensOnly: Tokens stored successfully');
        } else {
            this.log('debug', 'storeTokensOnly: No tokens to store', {
                hasAccessToken: !!tokens.accessToken,
                hasRefreshToken: !!tokens.refreshToken,
            });
        }
    }

    private async handleAuthResponse(response: IAuthResponse): Promise<void> {

        // Store tokens if in header mode and tokens are present
        const trustToken = (response as any).trustToken;
        if (response.accessToken && response.refreshToken) {
            await this.tokenManager.setTokens({
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
            });

            // Store trust token if present (works in both header and cookie mode)
            // In cookie mode, backend sets it as cookie, but we also store it for reference
            // In header mode, we need to send it in headers
            if (trustToken) {
                await this.tokenManager.setTrustToken(trustToken);
            }

            // Emit tokensSet event and wait for all listeners (include trust token if present)
            await this.events.emitAsync('tokensSet', {
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                trustToken: trustToken || undefined,
            });
        } 

        // Create session and set active tenant from token, then user, then first membership, then config default
        const decoded = response.accessToken ? decodeJwt(response.accessToken) : null;

        const activeTenantId = decoded?.tenantId;

        this.tenantId = activeTenantId;

        this.session = {
            id: decoded?.sessionId || '',
            userId: getUserIdFromToken(response.accessToken) || '',
            tenantId: activeTenantId,
            accessToken: this.tokenManager.isHeaderMode() ? response.accessToken : undefined,
            refreshToken: this.tokenManager.isHeaderMode() ? response.refreshToken : undefined,
            expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : undefined,
        };

        // Persist state
        await this.persistState();

        this.isAuthenticated = true;
    }

    // ============================================================================
    // Public API - Authentication
    // ============================================================================

    /**
     * Login with credentials
     */
    async login(dto: ILoginRequest, options?: RequestOptions): Promise<IAuthResponse> {
        const endpoint = this.getEndpoint('login');
        const response = await this.request<IAuthResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        // Check if MFA is required
        if (response.data.isRequiresMfa) {
            this.log('debug', 'login: MFA required - storing tokens for MFA flow');
            // Store tokens even when MFA is required so MFA APIs can be called
            // But don't set authenticated state until MFA is verified
            await this.storeTokensOnly({
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                trustToken: (response.data as any).trustToken,
            });
            return response.data;
        }

        // Full authentication - store tokens and set authenticated state
        await this.handleAuthResponse(response.data);
        return response.data;
    }

    /**
     * Social / OAuth login (RN-1). Acquire the provider token yourself (web
     * popup via Google Identity Services / Apple JS, or a native SDK like
     * `@react-native-google-signin`), then pass it here.
     *
     * Composes the `login` DTO and reuses the MFA-aware `login()` path. Defaults
     * `createUserIfNotExists: true` so a first-time social sign-in provisions the
     * account (matching the backend's social-login behaviour).
     *
     * @example
     * ```ts
     * // After getting an id token from Google Identity Services / native SDK:
     * const res = await authClient.socialLogin('google', idToken, { type: 'idToken' });
     * ```
     */
    async socialLogin(
        provider: 'google' | 'github' | 'facebook' | 'apple' | (string & {}),
        token: string,
        opts?: {
            type?: 'idToken' | 'accessToken';
            createUserIfNotExists?: boolean;
            tenantId?: string;
            /**
             * Nonce for native sign-in replay protection — pass the same nonce
             * you handed to the native Apple/Google SDK. The backend checks it
             * against the verified token.
             */
            nonce?: string;
            /**
             * Display name. Apple only returns the user's name on the FIRST
             * native sign-in, so pass it here to persist it.
             */
            name?: string;
            /** Extra credential fields some providers need. */
            extraCredentials?: Record<string, unknown>;
        },
        options?: RequestOptions,
    ): Promise<IAuthResponse> {
        const dto: ILoginRequest = {
            providerName: provider,
            credentials: {
                token,
                ...(opts?.type ? { type: opts.type } : {}),
                ...(opts?.nonce ? { nonce: opts.nonce } : {}),
                ...(opts?.name ? { name: opts.name } : {}),
                ...(opts?.extraCredentials ?? {}),
            } as ILoginRequest['credentials'],
            createUserIfNotExists: opts?.createUserIfNotExists ?? true,
            ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}),
        } as ILoginRequest;

        return this.login(dto, options);
    }

    /**
     * Sign up a new user
     */
    async signup(dto: ISignupRequest, options?: RequestOptions): Promise<IAuthResponse> {
        const endpoint = this.getEndpoint('signup');
        const response = await this.request<IAuthResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        await this.handleAuthResponse(response.data);
        return response.data;
    }

    /**
     * Passwordless — request a login code via email or SMS (`channel`).
     */
    async passwordlessSend(dto: IPasswordlessSendRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('passwordlessSend');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });
        if (!response.ok) {
            throw this.handleError(response);
        }
        return response.data;
    }

    /**
     * Passwordless — complete sign-in by exchanging the emailed/texted code for a
     * session (the completion step for {@link passwordlessSend}). Returns a normal
     * auth response and sets the session, exactly like {@link login}.
     *
     * `channel` defaults to trying both email and SMS; pass the one you sent to
     * for a single-channel check. ISOLATED-ready via `tenantId`.
     *
     * @example
     * ```ts
     * await auth.passwordlessSend({ identifier: 'a@b.com', channel: 'email', tenantId });
     * // ...user enters the code:
     * await auth.passwordlessLogin({ identifier: 'a@b.com', code: '123456', channel: 'email', tenantId });
     * ```
     */
    async passwordlessLogin(dto: IPasswordlessLoginRequest, options?: RequestOptions): Promise<IAuthResponse> {
        const channels = dto.channel
            ? (Array.isArray(dto.channel) ? dto.channel : [dto.channel])
            : (['email', 'sms'] as const);
        return this.login(
            {
                providerName: NEST_AUTH_PASSWORDLESS_PROVIDER,
                credentials: { identifier: dto.identifier, code: dto.code, channels } as ILoginRequest['credentials'],
                tenantId: dto.tenantId,
                rememberMe: dto.rememberMe,
            },
            options,
        );
    }


    /**
     * Clear tokens, in-memory state, persisted state, and emit logout events.
     * Shared by logout() and logoutAll().
     */
    private async clearAuthState(): Promise<void> {
        await this.tokenManager.clearTokens();
        await this.events.emitAsync('tokensRemoved', undefined);

        this.session = null;
        this.tenantId = undefined;
        this.isAuthenticated = false;

        await this.persistState();
        this.refreshQueue.cancel();
        this.retryTracker.clear();

        this.events.emit('logout', undefined);
        this.config.onLogout?.();
    }

    /**
     * Logout the current user
     */
    async logout(options?: RequestOptions): Promise<void> {
        const endpoint = this.getEndpoint('logout');

        try {
            await this.request<IMessageResponse>('POST', endpoint, undefined, { ...options, skipRefresh: true });
        } catch (error) {
            // Ignore logout errors - we'll clear local state anyway
            this.log('debug', 'Logout API call failed (state will be cleared anyway)', error);
        }

        await this.clearAuthState();
    }

    /**
     * Logout from all devices
     * This revokes all sessions for the current user
     */
    async logoutAll(options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('logoutAll');
        const response = await this.request<IMessageResponse>('POST', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        await this.clearAuthState();
        return response.data;
    }

    /**
     * Refresh tokens
     */
    async refresh(dto?: IRefreshRequest, options?: RequestOptions): Promise<ITokenPair | null> {
        // Use refresh queue to prevent parallel refresh calls
        return this.refreshQueue.refresh(async () => {
            const endpoint = this.getEndpoint('refresh');
            let body: IRefreshRequest | undefined = dto;

            // In header mode, include refresh token in body if not provided
            if (this.tokenManager.isHeaderMode() && !dto?.refreshToken) {
                const refreshToken = await this.tokenManager.getRefreshToken();
                if (refreshToken) {
                    body = { refreshToken };
                }
            }

            const response = await this.request<IAuthResponse>('POST', endpoint, body, { ...options, skipAuthHeader: true, skipRefresh: true });

            if (!response.ok) {
                // Refresh failed - logout
                await this.logout();
                throw this.handleError(response);
            }

            if (this.tokenManager.isCookieMode()) {
                // Cookies already updated by server
                this.events.emit('tokenRefreshed', null as any);
                return null;
            }
            if (!response.data.accessToken || !response.data.refreshToken) {
                throw {
                    message: 'Refresh response missing tokens in header mode',
                    statusCode: 500,
                };
            }

            const tokens: ITokenPair = {
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
            };

            // Store new tokens
            await this.tokenManager.setTokens(tokens);

            // Get trust token if present in response
            const trustToken = (response.data as any).trustToken;
            if (trustToken) {
                await this.tokenManager.setTrustToken(trustToken);
            }

            // Emit tokensSet event and wait for all listeners (include trust token if present)
            await this.events.emitAsync('tokensSet', {
                ...tokens,
                trustToken: trustToken || undefined,
            });

            // Update session
            const decoded = decodeJwt(tokens.accessToken);
            if (this.session) {
                this.session.accessToken = this.tokenManager.isHeaderMode() ? tokens.accessToken : undefined;
                this.session.refreshToken = this.tokenManager.isHeaderMode() ? tokens.refreshToken : undefined;
                this.session.expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : undefined;
            }

            // Persist state
            await this.persistState();

            this.isAuthenticated = true;

            // Emit events
            this.events.emit('tokenRefreshed', tokens);
            this.config.onTokenRefreshed?.(tokens);

            return tokens;
        });
    }

    /**
     * Verify session validity (lightweight check)
     * Use this when you only need to check if the session is valid
     */
    async verifySession(options?: RequestOptions): Promise<{ valid: boolean; userId?: string; expiresAt?: string }> {
        const endpoint = this.getEndpoint('verifySession');
        const response = await this.request<{ valid: boolean; userId?: string; expiresAt?: string }>('GET', endpoint, undefined, options);
        if (!response.ok) {
            if (response.status === 401) {
                // Unauthenticated - clear state
                this.session = null;
                await this.persistState();
            }
            return { valid: false };
        }

        this.isAuthenticated = true;
        this.events.emit('sessionVerified', undefined);

        return response.data;
    }

     async getSessionUserData(): Promise<ISessionUserData> {
        const endpoint = this.getEndpoint('me');
        const response = await this.request<ISessionUserData>('GET', endpoint, undefined);
        if (!response.ok) {
            throw this.handleError(response);
        }
        return response.data;
    }

    /**
     * Fetch the backend's PUBLIC client configuration (no auth required): tenant
     * mode, enabled auth methods, registration/MFA options, and whether
     * multi-account is enabled (`multipleAccounts.enabled`). Use it to drive
     * conditional UI — e.g. only show an account switcher when it's enabled.
     */
    async getClientConfig(options?: RequestOptions): Promise<IClientConfig> {
        const endpoint = this.getEndpoint('clientConfig');
        const response = await this.request<IClientConfig>('GET', endpoint, undefined, {
            skipAuthHeader: true,
            ...options,
        });
        if (!response.ok) {
            throw this.handleError(response);
        }
        return response.data;
    }

    /**
     * Switch active tenant (multi-tenant mode)
     */
    async switchTenant(dto: ISwitchTenantRequest, options?: RequestOptions): Promise<IAuthResponse> {
        const endpoint = this.getEndpoint('switchTenant');
        const response = await this.request<IAuthResponse>('POST', endpoint, dto, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        await this.handleAuthResponse(response.data);

        return response.data;
    }

    // ============================================================================
    // Public API - Password Management
    // ============================================================================

    /**
     * Request password reset
     */
    async forgotPassword(dto: IForgotPasswordRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('forgotPassword');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Verify forgot-password flow using the emailed/SMS `code` (not the MFA `otp` field).
     */
    async verifyForgotPasswordOtp(dto: IVerifyForgotPasswordOtpRequest, options?: RequestOptions): Promise<IVerifyOtpResponse> {
        const endpoint = this.getEndpoint('verifyForgotPasswordOtp');
        const response = await this.request<IVerifyOtpResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Reset password with token (from verifyForgotPasswordOtp)
     */
    async resetPassword(dto: IResetPasswordWithTokenRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('resetPassword');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Change password (authenticated)
     */
    async changePassword(dto: IChangePasswordRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('changePassword');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    // ============================================================================
    // Public API - Email Verification
    // ============================================================================


    /**
     * Request a new email verification code (authenticated). Body matches {@link ISendEmailVerificationRequest}.
     */
    async sendEmailVerification(dto: ISendEmailVerificationRequest = {}, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('sendEmailVerification');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Request a phone verification SMS (authenticated).
     */
    async sendPhoneVerification(dto: ISendPhoneVerificationRequest = {}, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('sendPhoneVerification');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Verify email address
     */
    async verifyEmail(dto: IVerifyEmailRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('verifyEmail');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        // Update user verification status
        this.events.emit('refreshSessionData', undefined);

        return response.data;
    }

    /**
     * Verify phone number with the SMS `code` (not the MFA `otp` field).
     */
    async verifyPhone(dto: IVerifyPhoneRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('verifyPhone');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }
        this.events.emit('refreshSessionData', undefined);
        return response.data;
    }

    // ============================================================================
    // Public API - 2FA
    // ============================================================================

    /**
     * Send 2FA code
     */
    async send2fa(method: 'email' | 'phone' = 'email', options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('send2fa');
        const response = await this.request<IMessageResponse>('POST', endpoint, { method }, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Verify 2FA code
     */
    async verify2fa(dto: IVerify2faRequest, options?: RequestOptions): Promise<IVerify2faResponse> {
        const endpoint = this.getEndpoint('verify2fa');
        const response = await this.request<IVerify2faResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }
        // Cast to IAuthResponse to handle user data properly
        await this.handleAuthResponse(response.data as IAuthResponse);

        return response.data;
    }

    /**
     * Setup TOTP device - generates secret and QR code
     */
    async setupTotp(options?: RequestOptions): Promise<ITotpSetupResponse> {
        const endpoint = this.getEndpoint('setupTotp');
        const response = await this.request<ITotpSetupResponse>('POST', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Verify TOTP setup - verifies the OTP code and marks device as verified
     */
    async verifyTotpSetup(dto: IVerifyTotpSetupRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('verifyTotpSetup');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Get MFA status for current user
     */
    async getMfaStatus(options?: RequestOptions): Promise<IMfaStatusResponse> {
        const endpoint = this.getEndpoint('getMfaStatus');
        const response = await this.request<IMfaStatusResponse>('GET', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * List all TOTP devices for current user
     */
    async listTotpDevices(options?: RequestOptions): Promise<IMfaDevice[]> {
        const endpoint = this.getEndpoint('listTotpDevices');
        const response = await this.request<IMfaDevice[]>('GET', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Remove a TOTP device
     */
    async removeTotpDevice(deviceId: string, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = `${this.getEndpoint('removeTotpDevice')}/${deviceId}`;
        const response = await this.request<IMessageResponse>('DELETE', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Toggle MFA on/off for current user
     */
    async toggleMfa(dto: IToggleMfaRequest, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('toggleMfa');
        const response = await this.request<IMessageResponse>('POST', endpoint, dto, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Generate recovery code for MFA
     */
    async generateRecoveryCode(options?: RequestOptions): Promise<{ code: string }> {
        const endpoint = this.getEndpoint('generateRecoveryCode');
        const response = await this.request<{ code: string }>('POST', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Reset MFA using recovery code
     * This will delete all MFA secrets and the recovery code after verification
     */
    async resetMfa(code: string, options?: RequestOptions): Promise<IMessageResponse> {
        const endpoint = this.getEndpoint('resetMfa');
        const response = await this.request<IMessageResponse>('POST', endpoint, { code }, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    // ============================================================================
    // Public API - Token Mode
    // ============================================================================

    /**
     * Set token mode
     */
    setMode(mode: 'header' | 'cookie'): void {
        if (this.config.accessTokenType !== null && this.config.accessTokenType !== mode) {
            this.log('warn', `Cannot change mode from '${this.config.accessTokenType}' to '${mode}' when accessTokenType is explicitly set`);
            return;
        }
        this.tokenManager.setMode(mode);
    }

    /**
     * Get current token mode
     */
    getMode(): 'header' | 'cookie' {
        return this.tokenManager.getMode();
    }

    // ============================================================================
    // Public API - Multi-tenant
    // ============================================================================

    /**
     * Set tenant ID
     */
    setTenantId(id: string): void {
        this.tenantId = id;
        if (this.session) {
            this.session = { ...this.session, tenantId: id };
            this.persistState().catch((error) => this.log('warn', 'Failed to persist tenant change', error))
        }
    }

    /**
     * Get tenant ID
     */
    getTenantId(): string | undefined {
        return this.getTenantIdValue();
    }

    // ============================================================================
    // Public API - State
    // ============================================================================


    /**
     * Get the current session
     */
    getSession(): ClientSession | null {
        return this.session;
    }

    /**
     * Check if user is authenticated
     */
    getIsAuthenticated(): boolean {
        return this.isAuthenticated;
    }

    /**
     * Get the access token (only in header mode)
     */
    async getAccessToken(): Promise<string | null> {
        return this.tokenManager.getAccessToken();
    }

    // ============================================================================
    // Public API - Events
    // ============================================================================

    /**
     * Subscribe to token refresh events
     */
    onTokenRefreshed(callback: (tokens: ITokenPair | null) => void): () => void {
        return this.events.on('tokenRefreshed', callback);
    }
    /**
     * Subscribe to logout events
     */
    onLogout(callback: () => void): () => void {
        return this.events.on('logout', callback);
    }

    /**
     * Subscribe to error events
     */
    onError(callback: (error: AuthError) => void): () => void {
        return this.events.on('error', callback);
    }

    /**
     * Subscribe to token set events (fires when tokens are stored)
     * Callback can be async and will be awaited
     */
    onTokensSet(callback: (tokens: ITokenPair & { trustToken?: string }) => void | Promise<void>): () => void {
        return this.events.on('tokensSet', callback);
    }

    /**
     * Subscribe to token removed events (fires when tokens are cleared)
     * Callback can be async and will be awaited
     */
    onTokensRemoved(callback: () => void | Promise<void>): () => void {
        return this.events.on('tokensRemoved', callback);
    }

    /**
     * Subscribe to session verified events (fires when session is verified)
     */
    onSessionVerified(callback: () => void): () => void {
        return this.events.on('sessionVerified', callback);
    }

    /**
     * Subscribe to refresh session data events (fires when session data is refreshed)
     */
    onRefreshSessionData(callback: () => void): () => void {
        return this.events.on('refreshSessionData', callback);
    }

    // ============================================================================
    // T-167b — public auth-header APIs for consumer HTTP clients
    //
    // These are the SUPPORTED public surface for wiring up your own axios/fetch
    // instance to share auth state with this AuthClient. They replace the old
    // `onTokensSet` patch pattern documented in .tasks/client-sdk-token-handling.md.
    //
    // Use `getAuthHeadersSync()` from inside an axios.interceptors.request
    // callback (sync); use `getAuthHeaders()` if you can be async (e.g. fetch wrapper).
    // ============================================================================

    /**
     * Get the headers to attach to outgoing requests so they share auth state
     * with this AuthClient. Async — consults storage on mirror miss (the rare
     * case where this client instance was just created and warm-up isn't done).
     *
     * Returns an object suitable for spreading into request headers:
     *   - `Authorization: 'Bearer ...'` — only in header mode, only if logged in
     *   - `x-access-token-type: 'header' | 'cookie'` — always
     *   - `<trustDeviceHeaderName>: '...'` — only in header mode if a trust token is set
     *
     * @example
     * ```ts
     * // Custom fetch wrapper
     * const headers = await authClient.getAuthHeaders();
     * await fetch('/my-api', { headers });
     * ```
     */
    async getAuthHeaders(opts?: GetAuthHeadersOptions): Promise<Record<string, string>> {
        const headers: Record<string, string> = {};

        const mode = this.tokenManager.getMode();
        if (mode && opts?.includeAccessTokenTypeHeader !== false) {
            headers['x-access-token-type'] = mode;
        }

        if (this.tokenManager.isHeaderMode() && opts?.skipAuthHeader !== true) {
            const authHeader = await this.tokenManager.getAuthorizationHeader();
            if (authHeader) {
                const headerName = opts?.authHeaderName ?? 'Authorization';
                headers[headerName] = authHeader;
            }
        }

        if (this.tokenManager.isHeaderMode() && opts?.includeTrustToken !== false) {
            const trust = await this.tokenManager.getTrustToken();
            if (trust) {
                const name = opts?.trustHeaderName ?? this.config.trustDeviceHeaderName ?? 'nest_auth_device_trust';
                headers[name] = trust;
            }
        }

        return headers;
    }

    /**
     * Sync version of `getAuthHeaders` — reads only the in-memory mirror
     * (populated by `setTokens` / `setTrustToken`, or by `await ready()` after
     * construction). Use this in synchronous axios request interceptors.
     *
     * Returns the same shape as `getAuthHeaders`. If the mirror is empty
     * (no login yet, or warm-up still pending), the `Authorization` and trust
     * headers are simply omitted — the request goes out unauthenticated,
     * which is the right thing for a not-yet-logged-in user.
     */
    getAuthHeadersSync(opts?: GetAuthHeadersOptions): Record<string, string> {
        const headers: Record<string, string> = {};

        const mode = this.tokenManager.getMode();
        if (mode && opts?.includeAccessTokenTypeHeader !== false) {
            headers['x-access-token-type'] = mode;
        }

        if (this.tokenManager.isHeaderMode() && opts?.skipAuthHeader !== true) {
            const authHeader = this.tokenManager.getAuthorizationHeaderSync();
            if (authHeader) {
                const headerName = opts?.authHeaderName ?? 'Authorization';
                headers[headerName] = authHeader;
            }
        }

        if (this.tokenManager.isHeaderMode() && opts?.includeTrustToken !== false) {
            const trust = this.tokenManager.getTrustTokenSync();
            if (trust) {
                const name = opts?.trustHeaderName ?? this.config.trustDeviceHeaderName ?? 'nest_auth_device_trust';
                headers[name] = trust;
            }
        }

        return headers;
    }

    /**
     * Whether outgoing requests to the consumer's own backend should set
     * `credentials: 'include'` (cookie mode) or not.
     *
     * Mirrors what this AuthClient does for its own requests. Helpful when
     * the consumer is wiring up a fetch wrapper / axios instance.
     */
    shouldSendCookies(): boolean {
        return this.tokenManager.isCookieMode();
    }

    /**
     * Wait for the TokenManager's initial async warm-up to complete.
     * Call this once at app boot if you plan to rely on `getAuthHeadersSync()`
     * immediately on first render (rare; useful for SSR-without-storage scenarios).
     */
    async ready(): Promise<void> {
        await this.tokenManager.ready();
    }

    // ============================================================================
    // T-167c — HTTP-client attach helpers
    //
    // One-line replacements for the legacy `onTokensSet` patch pattern.
    // See .tasks/client-sdk-token-handling.md for the design rationale.
    // ============================================================================

    /**
     * Wire an axios-like instance to share auth state with this AuthClient.
     * Returns an unsubscribe function — call it on logout/unmount to detach.
     *
     * @example
     * ```ts
     * import axios from 'axios';
     * const api = axios.create({ baseURL: '/api' });
     * const unsubscribe = authClient.attachToAxios(api, { retryOn401: true });
     * ```
     *
     * See [`http-attach.ts`](./http-attach.ts) for full options.
     */
    attachToAxios(instance: AxiosLikeInstance, opts?: AttachOptions): () => void {
        return attachToAxios(this, instance, opts);
    }

    /**
     * Wrap a fetch function so every call automatically attaches auth headers
     * and retries once on 401 after refresh.
     *
     * @example
     * ```ts
     * const myFetch = authClient.attachToFetch(); // wraps globalThis.fetch
     * const res = await myFetch('/api/data');
     * ```
     */
    attachToFetch(baseFetch?: typeof globalThis.fetch, opts?: AttachOptions): typeof globalThis.fetch {
        return attachToFetch(this, baseFetch ?? globalThis.fetch, opts);
    }

    // ============================================================================
    // T-167d — observable token state
    //
    // For consumers outside React (web workers, service workers, analytics, native
    // bridges) that need to react to auth state changes. Wraps the existing event
    // emitter into a clean state-store API.
    // ============================================================================

    /**
     * Get a snapshot of the current token state. Synchronous; reads only the
     * in-memory mirror via the TokenManager.
     */
    getTokenState(): TokenState {
        const accessToken = this.tokenManager.getAccessTokenSync();
        const decoded = accessToken ? decodeJwt(accessToken) : null;
        return {
            accessToken,
            mode: this.tokenManager.getMode(),
            isAuthenticated: this.isAuthenticated,
            expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : null,
            userId: accessToken ? getUserIdFromToken(accessToken) : null,
        };
    }

    /**
     * Subscribe to token-state changes. Fires whenever tokens are set, refreshed,
     * or cleared. Subscriber receives the latest `TokenState`.
     *
     * Returns an unsubscribe function for cleanup.
     *
     * @example
     * ```ts
     * const unsub = authClient.subscribeTokenState((state) => {
     *   console.log('Token state changed:', state);
     * });
     * // later:
     * unsub();
     * ```
     */
    subscribeTokenState(listener: (state: TokenState) => void): () => void {
        // Multiplex over the three relevant events
        const unsubSet = this.events.on('tokensSet', () => listener(this.getTokenState()));
        const unsubRefreshed = this.events.on('tokenRefreshed', () => listener(this.getTokenState()));
        const unsubRemoved = this.events.on('tokensRemoved', () => listener(this.getTokenState()));
        return () => {
            unsubSet();
            unsubRefreshed();
            unsubRemoved();
        };
    }
}
