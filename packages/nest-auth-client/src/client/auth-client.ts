/**
 * Core AuthClient class
 * Framework-agnostic authentication client
 */

import {
    IAuthUser as AuthUser,
    ITokenPair as TokenPair,
    ILoginRequest as LoginDto,
    ISignupRequest as SignupDto,
    IRefreshRequest as RefreshDto,
    IForgotPasswordRequest as ForgotPasswordDto,
    IResetPasswordWithTokenRequest as ResetPasswordDto,
    IVerifyEmailRequest as VerifyEmailDto,
    IResendVerificationRequest as ResendVerificationDto,
    IChangePasswordRequest as ChangePasswordDto,
    IVerify2faRequest as Verify2faDto,
    IAuthResponse as AuthResponse,
    IMessageResponse as MessageResponse,
    IVerifyOtpResponse as VerifyOtpResponse,
    IVerify2faResponse as Verify2faResponse,
    ITotpSetupResponse,
    IVerifyTotpSetupRequest,
    IMfaStatusResponse,
    IMfaDevice,
    IToggleMfaRequest,
    ISwitchTenantRequest,
    INestAuthUserAccess,
} from '@ackplus/nest-auth-contracts';
import {
    AuthClientConfig,
    HttpResponse,
    RequestOptions,
    DEFAULT_ENDPOINTS,
} from '../types/config.types';
import { ClientSession } from '../types/auth.types';
import { AuthError } from '../types/auth.types';
import { LocalStorageAdapter } from '../storage/local.storage';
import { FetchAdapter } from '../http/fetch.adapter';
import { TokenManager } from '../token/token-manager';
import { decodeJwt, getUserIdFromToken } from '../token/jwt-utils';
import { EventEmitter, AuthEvents } from './event-emitter';
import { RefreshQueue, RetryTracker } from './refresh-queue';

/** Storage keys */
const STORAGE_KEYS = {
    USER: 'user',
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

    private user: AuthUser | null = null;
    private session: ClientSession | null = null;

    private userAccesses: INestAuthUserAccess[] | undefined;

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
            const userJson = await Promise.resolve(this.config.storage!.get(STORAGE_KEYS.USER));
            if (userJson) {
                this.user = JSON.parse(userJson);
                this.userAccesses = this.user?.userAccesses ?? undefined;
            }

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
            if (this.user) {
                await Promise.resolve(this.config.storage!.set(STORAGE_KEYS.USER, JSON.stringify(this.user)));
            } else {
                await Promise.resolve(this.config.storage!.remove(STORAGE_KEYS.USER));
            }

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
        if (this.tokenManager.isHeaderMode()) {
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

        let response = await makeRequest();

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

    private async handleAuthResponse(response: AuthResponse): Promise<void> {
        this.log('debug', 'handleAuthResponse: Processing auth response', {
            hasAccessToken: !!response.accessToken,
            hasRefreshToken: !!response.refreshToken,
            hasUser: !!response.user,
            hasTrustToken: !!(response as any).trustToken,
            mode: this.tokenManager.getMode(),
        });

        // Store tokens if in header mode and tokens are present
        const trustToken = (response as any).trustToken;
        if (response.accessToken && response.refreshToken) {
            this.log('debug', 'handleAuthResponse: Storing tokens');
            await this.tokenManager.setTokens({
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
            });
            
            // Store trust token if present (works in both header and cookie mode)
            // In cookie mode, backend sets it as cookie, but we also store it for reference
            // In header mode, we need to send it in headers
            if (trustToken) {
                this.log('debug', 'handleAuthResponse: Storing trust token');
                await this.tokenManager.setTrustToken(trustToken);
            }
            
            // Emit tokensSet event and wait for all listeners (include trust token if present)
            await this.events.emitAsync('tokensSet', {
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                trustToken: trustToken || undefined,
            });
        } else {
            this.log('debug', 'handleAuthResponse: No tokens to store', {
                hasAccessToken: !!response.accessToken,
                hasRefreshToken: !!response.refreshToken,
            });
        }

        // Update user if present
        if (response.user) {
            this.user = response.user;
            this.userAccesses = response.user.userAccesses ?? undefined;
        } else {
            this.userAccesses = undefined;
        }

        // Create session and set active tenant from token, then user, then first membership, then config default
        const decoded = response.accessToken ? decodeJwt(response.accessToken) : null;
        
        const activeTenantId = decoded?.tenantId;

        this.tenantId = activeTenantId;

        this.session = {
            id: decoded?.sessionId || '',
            userId: response.user?.id || getUserIdFromToken(response.accessToken) || '',
            tenantId: activeTenantId,
            accessToken: this.tokenManager.isHeaderMode() ? response.accessToken : undefined,
            refreshToken: this.tokenManager.isHeaderMode() ? response.refreshToken : undefined,
            expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : undefined,
        };

        // Persist state
        await this.persistState();

        // Emit events
        this.events.emit('authStateChange', { user: this.user });
        this.config.onAuthStateChange?.(this.user);

        this.log('debug', 'handleAuthResponse: Auth response processed successfully');
    }

    // ============================================================================
    // Public API - Authentication
    // ============================================================================

    /**
     * Login with credentials
     */
    async login(dto: LoginDto, options?: RequestOptions): Promise<AuthResponse> {
        const endpoint = this.getEndpoint('login');
        const response = await this.request<AuthResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

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
     * Sign up a new user
     */
    async signup(dto: SignupDto, options?: RequestOptions): Promise<AuthResponse> {
        const endpoint = this.getEndpoint('signup');
        const response = await this.request<AuthResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        await this.handleAuthResponse(response.data);
        return response.data;
    }

    /**
     * Clear tokens, in-memory state, persisted state, and emit logout events.
     * Shared by logout() and logoutAll().
     */
    private async clearAuthState(): Promise<void> {
        await this.tokenManager.clearTokens();
        await this.tokenManager.clearTrustToken();
        await this.events.emitAsync('tokensRemoved', undefined);

        this.user = null;
        this.session = null;
        this.tenantId = undefined;
        this.userAccesses = undefined;

        await this.persistState();
        this.refreshQueue.cancel();
        this.retryTracker.clear();

        this.events.emit('logout', undefined);
        this.events.emit('authStateChange', { user: null });
        this.config.onLogout?.();
        this.config.onAuthStateChange?.(null);
    }

    /**
     * Logout the current user
     */
    async logout(options?: RequestOptions): Promise<void> {
        const endpoint = this.getEndpoint('logout');

        try {
            await this.request<MessageResponse>('POST', endpoint, undefined, { ...options, skipRefresh: true });
        } catch (error) {
            // Ignore logout errors - we'll clear local state anyway
            this.log('debug', 'Logout API call failed (state will be cleared anyway)', error );
        }

        await this.clearAuthState();
    }

    /**
     * Logout from all devices
     * This revokes all sessions for the current user
     */
    async logoutAll(options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('logoutAll');
        const response = await this.request<MessageResponse>('POST', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        await this.clearAuthState();
        return response.data;
    }

    /**
     * Refresh tokens
     */
    async refresh(dto?: RefreshDto, options?: RequestOptions): Promise<TokenPair> {
        // Use refresh queue to prevent parallel refresh calls
        return this.refreshQueue.refresh(async () => {
            const endpoint = this.getEndpoint('refresh');
            let body: RefreshDto | undefined = dto;

            // In header mode, include refresh token in body if not provided
            if (this.tokenManager.isHeaderMode() && !dto?.refreshToken) {
                const refreshToken = await this.tokenManager.getRefreshToken();
                if (refreshToken) {
                    body = { refreshToken };
                }
            }

            const response = await this.request<AuthResponse>('POST', endpoint, body, { ...options, skipRefresh: true });

            if (!response.ok) {
                // Refresh failed - logout
                await this.logout();
                throw this.handleError(response);
            }

            const tokens: TokenPair = {
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
                this.user = null;
                this.session = null;
                await this.persistState();
                this.events.emit('authStateChange', { user: null });
                this.config.onAuthStateChange?.(null);
            }
            return { valid: false };
        }

        return response.data;
    }

    /**
     * Switch active tenant (multi-tenant mode)
     */
    async switchTenant(dto: ISwitchTenantRequest, options?: RequestOptions): Promise<AuthResponse> {
        const endpoint = this.getEndpoint('switchTenant');
        const response = await this.request<AuthResponse>('POST', endpoint, dto, options);

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
    async forgotPassword(dto: ForgotPasswordDto, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('forgotPassword');
        const response = await this.request<MessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Verify forgot password OTP
     */
    async verifyForgotPasswordOtp(dto: { email?: string; phone?: string; otp: string }, options?: RequestOptions): Promise<VerifyOtpResponse> {
        const endpoint = this.getEndpoint('verifyForgotPasswordOtp');
        const response = await this.request<VerifyOtpResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Reset password with token (from verifyForgotPasswordOtp)
     */
    async resetPassword(dto: ResetPasswordDto, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('resetPassword');
        const response = await this.request<MessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Change password (authenticated)
     */
    async changePassword(dto: ChangePasswordDto, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('changePassword');
        const response = await this.request<MessageResponse>('POST', endpoint, dto, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    // ============================================================================
    // Public API - Email Verification
    // ============================================================================

    /**
     * Verify email address
     */
    async verifyEmail(dto: VerifyEmailDto, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('verifyEmail');
        const response = await this.request<MessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        // Update user verification status
        if (this.user) {
            this.user.isVerified = true;
            await this.persistState();
        }

        return response.data;
    }

    /**
     * Resend verification email
     */
    async resendVerification(dto: ResendVerificationDto, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('resendVerification');
        const response = await this.request<MessageResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    // ============================================================================
    // Public API - 2FA
    // ============================================================================

    /**
     * Send 2FA code
     */
    async send2fa(method: 'email' | 'phone' = 'email', options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('send2fa');
        const response = await this.request<MessageResponse>('POST', endpoint, { method }, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Verify 2FA code
     */
    async verify2fa(dto: Verify2faDto, options?: RequestOptions): Promise<Verify2faResponse> {
        const endpoint = this.getEndpoint('verify2fa');
        const response = await this.request<Verify2faResponse>('POST', endpoint, dto, { ...options, skipRefresh: true });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const responseData = response.data as any;
        this.log('debug', 'verify2fa: Response received', {
            hasAccessToken: !!responseData.accessToken,
            hasRefreshToken: !!responseData.refreshToken,
            hasUser: !!responseData.user,
            userData: responseData.user ? {
                id: responseData.user.id,
                email: responseData.user.email,
                roles: responseData.user.roles,
                permissions: responseData.user.permissions,
            } : null,
        });

        // Cast to AuthResponse to handle user data properly
        await this.handleAuthResponse(response.data as AuthResponse);
        
        this.log('debug', 'verify2fa: State updated', {
            userSet: !!this.user,
            sessionSet: !!this.session,
        });

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
    async verifyTotpSetup(dto: IVerifyTotpSetupRequest, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('verifyTotpSetup');
        const response = await this.request<MessageResponse>('POST', endpoint, dto, options);

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
    async removeTotpDevice(deviceId: string, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = `${this.getEndpoint('removeTotpDevice')}/${deviceId}`;
        const response = await this.request<MessageResponse>('DELETE', endpoint, undefined, options);

        if (!response.ok) {
            throw this.handleError(response);
        }

        return response.data;
    }

    /**
     * Toggle MFA on/off for current user
     */
    async toggleMfa(dto: IToggleMfaRequest, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('toggleMfa');
        const response = await this.request<MessageResponse>('POST', endpoint, dto, options);

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
    async resetMfa(code: string, options?: RequestOptions): Promise<MessageResponse> {
        const endpoint = this.getEndpoint('resetMfa');
        const response = await this.request<MessageResponse>('POST', endpoint, { code }, options);

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
            this.persistState().catch((error) =>  this.log('warn', 'Failed to persist tenant change', error))
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
     * Get the current authenticated user
     */
    getUser(): AuthUser | null {
        return this.user;
    }

    /**
     * Get the current session
     */
    getSession(): ClientSession | null {
        return this.session;
    }

    /**
     * Get the current user's accesses per tenant (when available from auth response).
     */
    getUserAccesses(): INestAuthUserAccess[] | undefined {
        return this.userAccesses;
    }

    /**
     * @deprecated Use getUserAccesses() instead.
     */
    getTenantMemberships(): INestAuthUserAccess[] | undefined {
        return this.userAccesses;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.user !== null;
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
     * Subscribe to auth state changes
     */
    onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
        return this.events.on('authStateChange', ({ user }) => callback(user));
    }

    /**
     * Subscribe to token refresh events
     */
    onTokenRefreshed(callback: (tokens: TokenPair) => void): () => void {
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
    onTokensSet(callback: (tokens: TokenPair & { trustToken?: string }) => void | Promise<void>): () => void {
        return this.events.on('tokensSet', callback);
    }

    /**
     * Subscribe to token removed events (fires when tokens are cleared)
     * Callback can be async and will be awaited
     */
    onTokensRemoved(callback: () => void | Promise<void>): () => void {
        return this.events.on('tokensRemoved', callback);
    }
}
