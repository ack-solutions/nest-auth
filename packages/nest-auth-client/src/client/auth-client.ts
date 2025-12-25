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
    IResetPasswordRequest as ResetPasswordDto,
    IVerifyEmailRequest as VerifyEmailDto,
    IResendVerificationRequest as ResendVerificationDto,
    IChangePasswordRequest as ChangePasswordDto,
    IVerify2faRequest as Verify2faDto,
    IAuthResponse as AuthResponse,
    IAuthUser as MeResponse,
    IMessageResponse as MessageResponse,
    IVerifyOtpResponse as VerifyOtpResponse,
    IVerify2faResponse as Verify2faResponse,
} from '@libs/auth-types';
import {
    AuthClientConfig,
    ClientSession,
    AuthError,
    HttpResponse,
    RequestOptions,
    DEFAULT_ENDPOINTS,
} from '../types';
import { LocalStorageAdapter, MemoryStorage } from '../storage';
import { FetchAdapter } from '../http';
import { TokenManager } from '../token';
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
            tenantHeader: config.tenantHeader ?? 'x-tenant-id',
        };

        // Initialize tenant ID
        if (typeof config.tenantId === 'function') {
            this.tenantId = config.tenantId();
        } else {
            this.tenantId = config.tenantId;
        }

        // Initialize token manager
        this.tokenManager = new TokenManager({
            storage: this.config.storage!,
            accessTokenType: this.config.accessTokenType!,
            refreshThreshold: this.config.refreshThreshold,
        });

        // Initialize utilities
        this.events = new EventEmitter<AuthEvents>();
        this.refreshQueue = new RefreshQueue();
        this.retryTracker = new RetryTracker();

        // Load persisted state
        this.loadPersistedState();
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
            }

            const sessionJson = await Promise.resolve(this.config.storage!.get(STORAGE_KEYS.SESSION));
            if (sessionJson) {
                this.session = JSON.parse(sessionJson);
            }
        } catch (error) {
            this.log('warn', 'Failed to load persisted auth state', error);
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
        if (typeof this.config.tenantId === 'function') {
            return this.config.tenantId();
        }
        return this.tenantId ?? this.config.tenantId;
    }

    private async buildHeaders(options?: RequestOptions): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options?.headers,
        };

        // Add authorization header if in header mode
        if (this.tokenManager.isHeaderMode()) {
            const authHeader = await this.tokenManager.getAuthorizationHeader();
            if (authHeader) {
                headers['Authorization'] = authHeader;
            }
        }

        // Add tenant header
        const tenantId = this.getTenantIdValue();
        if (tenantId) {
            headers[this.config.tenantHeader!] = tenantId;
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

    private async handleAuthResponse(response: AuthResponse): Promise<void> {
        // Store tokens if in header mode and tokens are present
        if (response.accessToken && response.refreshToken) {
            await this.tokenManager.setTokens({
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
            });
        }

        // Update user if present
        if (response.user) {
            this.user = response.user;
        }

        // Create session
        const decoded = response.accessToken ? decodeJwt(response.accessToken) : null;
        this.session = {
            id: decoded?.sessionId || '',
            userId: response.user?.id || getUserIdFromToken(response.accessToken) || '',
            accessToken: this.tokenManager.isHeaderMode() ? response.accessToken : undefined,
            refreshToken: this.tokenManager.isHeaderMode() ? response.refreshToken : undefined,
            expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : undefined,
        };

        // Persist state
        await this.persistState();

        // Emit events
        this.events.emit('authStateChange', { user: this.user });
        this.config.onAuthStateChange?.(this.user);
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
            return response.data;
        }

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
     * Logout the current user
     */
    async logout(options?: RequestOptions): Promise<void> {
        const endpoint = this.getEndpoint('logout');

        try {
            await this.request<MessageResponse>('POST', endpoint, undefined, { ...options, skipRefresh: true });
        } catch {
            // Ignore logout errors - we'll clear local state anyway
        }

        // Clear tokens
        await this.tokenManager.clearTokens();

        // Clear state
        this.user = null;
        this.session = null;

        // Clear persisted state
        await this.persistState();

        // Cancel any pending refreshes
        this.refreshQueue.cancel();
        this.retryTracker.clear();

        // Emit events
        this.events.emit('logout', undefined);
        this.events.emit('authStateChange', { user: null });
        this.config.onLogout?.();
        this.config.onAuthStateChange?.(null);
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

        await this.handleAuthResponse(response.data as AuthResponse);
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
}
