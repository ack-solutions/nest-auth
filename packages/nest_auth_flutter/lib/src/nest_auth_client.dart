import 'dart:convert';

import 'package:http/http.dart' as http;

import 'exceptions.dart';
import 'models.dart';
import 'token_storage.dart';

/// HTTP client for a `@ackplus/nest-auth` backend, in header-token mode.
///
/// Tokens are persisted through the supplied [TokenStorage] and sent in the
/// `Authorization` header. A 401 on an authenticated request triggers a single
/// transparent refresh-and-retry.
///
/// ```dart
/// final client = NestAuthClient(
///   baseUrl: 'https://api.example.com',
///   storage: SecureTokenStorage(),
/// );
/// await client.loginWithEmail('a@b.com', 'secret');
/// final user = await client.getSessionUserData();
/// ```
class NestAuthClient {
  final String baseUrl;
  final TokenStorage storage;
  final http.Client _http;

  static const _accessKey = 'accessToken';
  static const _refreshKey = 'refreshToken';

  // Endpoint paths (relative to baseUrl; match the backend's auth controller).
  static const _loginPath = '/auth/login';
  static const _signupPath = '/auth/signup';
  static const _logoutPath = '/auth/logout';
  static const _refreshPath = '/auth/refresh-token';
  static const _mePath = '/auth/me';
  static const _passwordlessSendPath = '/auth/passwordless/send';
  static const _forgotPasswordPath = '/auth/forgot-password';
  static const _verifyForgotPasswordOtpPath = '/auth/verify-forgot-password-otp';
  static const _resetPasswordPath = '/auth/reset-password';
  static const _changePasswordPath = '/auth/change-password';
  static const _sendEmailVerificationPath = '/auth/send-email-verification';
  static const _verifyEmailPath = '/auth/verify-email';
  static const _sendPhoneVerificationPath = '/auth/send-phone-verification';
  static const _verifyPhonePath = '/auth/verify-phone';
  static const _switchTenantPath = '/auth/switch-tenant';
  static const _mfaChallengePath = '/auth/mfa/challenge';
  static const _mfaVerifyPath = '/auth/mfa/verify';
  static const _mfaStatusPath = '/auth/mfa/status';

  NestAuthClient({
    required String baseUrl,
    TokenStorage? storage,
    http.Client? httpClient,
  })  : baseUrl = baseUrl.endsWith('/')
            ? baseUrl.substring(0, baseUrl.length - 1)
            : baseUrl,
        storage = storage ?? InMemoryTokenStorage(),
        _http = httpClient ?? http.Client();

  /// The current access token, or null when signed out.
  Future<String?> get accessToken => storage.read(_accessKey);

  /// Whether an access token is currently stored.
  Future<bool> get isAuthenticated async =>
      (await storage.read(_accessKey)) != null;

  /// Register a new account. Returns tokens and persists them.
  Future<AuthResponse> signup({
    String? email,
    String? phone,
    required String password,
    String? tenantId,
    Map<String, dynamic>? extra,
  }) async {
    final body = <String, dynamic>{
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      'password': password,
      if (tenantId != null) 'tenantId': tenantId,
      ...?extra,
    };
    final json = await _send('POST', _signupPath, body: body, auth: false);
    final auth = AuthResponse.fromJson(json);
    await _storeTokens(auth.accessToken, auth.refreshToken);
    return auth;
  }

  /// Log in with a provider (default `email`). For email/password pass
  /// `credentials: {'email': ..., 'password': ...}`.
  Future<AuthResponse> login({
    String providerName = 'email',
    required Map<String, dynamic> credentials,
    bool createUserIfNotExists = false,
    String? tenantId,
  }) async {
    final body = <String, dynamic>{
      'providerName': providerName,
      'credentials': credentials,
      'createUserIfNotExists': createUserIfNotExists,
      if (tenantId != null) 'tenantId': tenantId,
    };
    final json = await _send('POST', _loginPath, body: body, auth: false);
    final auth = AuthResponse.fromJson(json);
    if (auth.accessToken.isNotEmpty) {
      await _storeTokens(auth.accessToken, auth.refreshToken);
    }
    return auth;
  }

  /// Convenience email/password login.
  Future<AuthResponse> loginWithEmail(String email, String password) =>
      login(credentials: {'email': email, 'password': password});

  /// Social login — acquire the provider token natively first.
  ///
  /// - `type`: for Google, `'idToken'` (default) or `'accessToken'`.
  /// - `nonce`: native replay-protection nonce; must match the token's nonce.
  /// - `name`: Apple only returns the name on the first sign-in — pass it here.
  Future<AuthResponse> socialLogin(
    String providerName,
    String token, {
    String? type,
    String? nonce,
    String? name,
  }) =>
      login(
        providerName: providerName,
        credentials: {
          'token': token,
          if (type != null) 'type': type,
          if (nonce != null) 'nonce': nonce,
          if (name != null) 'name': name,
        },
        createUserIfNotExists: true,
      );

  /// Fetch the current session user (`GET /auth/me`).
  Future<SessionUser> getSessionUserData() async {
    final json = await _send('GET', _mePath, auth: true);
    return SessionUser.fromJson(json);
  }

  /// Exchange the stored refresh token for a fresh pair. Returns null when
  /// there is nothing to refresh.
  Future<TokenPair?> refresh() async {
    final rt = await storage.read(_refreshKey);
    if (rt == null) return null;
    final json =
        await _send('POST', _refreshPath, body: {'refreshToken': rt}, auth: false);
    final access = json['accessToken'] as String? ?? '';
    if (access.isEmpty) return null;
    final pair = TokenPair(
      accessToken: access,
      refreshToken: json['refreshToken'] as String? ?? rt,
    );
    await _storeTokens(pair.accessToken, pair.refreshToken);
    return pair;
  }

  /// Log out — revokes the session server-side (best effort) and clears local
  /// tokens regardless.
  Future<void> logout() async {
    try {
      await _send('POST', _logoutPath, body: {}, auth: true);
    } catch (_) {
      // Ignore — we still clear local state below.
    }
    await storage.delete(_accessKey);
    await storage.delete(_refreshKey);
  }

  // --- Passwordless ----------------------------------------------------------

  /// Send a passwordless login code. `channel` is `'email'` or `'sms'`,
  /// `identifier` is the matching email / phone.
  Future<Map<String, dynamic>> passwordlessSend({
    required String identifier,
    required String channel,
    String? tenantId,
  }) =>
      _send('POST', _passwordlessSendPath, auth: false, body: {
        'identifier': identifier,
        'channel': channel,
        if (tenantId != null) 'tenantId': tenantId,
      });

  /// Complete a passwordless login with the received `code`. Persists tokens.
  Future<AuthResponse> passwordlessLogin({
    required String identifier,
    required String code,
    String channel = 'email',
    String? tenantId,
  }) =>
      login(
        providerName: 'passwordless',
        credentials: {
          'identifier': identifier,
          'code': code,
          'channels': [channel],
        },
        tenantId: tenantId,
      );

  // --- Password management ----------------------------------------------------

  /// Request a password-reset code (sent by email or SMS).
  Future<Map<String, dynamic>> forgotPassword({String? email, String? phone}) =>
      _send('POST', _forgotPasswordPath, auth: false, body: {
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      });

  /// Verify the reset code; returns a `resetToken`/`token` to pass to
  /// [resetPassword].
  Future<Map<String, dynamic>> verifyForgotPasswordOtp({
    String? email,
    String? phone,
    required String code,
    String? tenantId,
  }) =>
      _send('POST', _verifyForgotPasswordOtpPath, auth: false, body: {
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
        'code': code,
        if (tenantId != null) 'tenantId': tenantId,
      });

  /// Set a new password using the token from [verifyForgotPasswordOtp].
  Future<Map<String, dynamic>> resetPassword({
    required String token,
    required String newPassword,
  }) =>
      _send('POST', _resetPasswordPath, auth: false, body: {
        'token': token,
        'newPassword': newPassword,
      });

  /// Change the password for the signed-in user.
  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) =>
      _send('POST', _changePasswordPath, auth: true, body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  // --- Email / phone verification --------------------------------------------

  /// Send an email-verification code to the signed-in user.
  Future<Map<String, dynamic>> sendEmailVerification({String? tenantId}) =>
      _send('POST', _sendEmailVerificationPath, auth: true, body: {
        if (tenantId != null) 'tenantId': tenantId,
      });

  /// Verify the email with the received `code`.
  Future<Map<String, dynamic>> verifyEmail({
    required String code,
    String? tenantId,
  }) =>
      _send('POST', _verifyEmailPath, auth: true, body: {
        'code': code,
        if (tenantId != null) 'tenantId': tenantId,
      });

  /// Send a phone-verification SMS to the signed-in user.
  Future<Map<String, dynamic>> sendPhoneVerification({String? tenantId}) =>
      _send('POST', _sendPhoneVerificationPath, auth: true, body: {
        if (tenantId != null) 'tenantId': tenantId,
      });

  /// Verify the phone with the received `code`.
  Future<Map<String, dynamic>> verifyPhone({
    required String code,
    String? tenantId,
  }) =>
      _send('POST', _verifyPhonePath, auth: true, body: {
        'code': code,
        if (tenantId != null) 'tenantId': tenantId,
      });

  // --- Multi-tenancy ----------------------------------------------------------

  /// Switch the active tenant; returns fresh tokens for the new tenant and
  /// persists them.
  Future<AuthResponse> switchTenant(String tenantId) async {
    final json = await _send('POST', _switchTenantPath,
        auth: true, body: {'tenantId': tenantId});
    final auth = AuthResponse.fromJson(json);
    if (auth.accessToken.isNotEmpty) {
      await _storeTokens(auth.accessToken, auth.refreshToken);
    }
    return auth;
  }

  // --- MFA --------------------------------------------------------------------

  /// During an MFA-gated login, request an email/SMS one-time code.
  /// `method` is `'email'` or `'phone'`.
  Future<Map<String, dynamic>> sendMfaChallenge({String method = 'email'}) =>
      _send('POST', _mfaChallengePath, auth: true, body: {'method': method});

  /// Complete an MFA-gated login with the one-time `otp`. Persists tokens.
  Future<AuthResponse> verifyMfa({
    required String otp,
    String? method,
    bool trustDevice = false,
  }) async {
    final json = await _send('POST', _mfaVerifyPath, auth: true, body: {
      'otp': otp,
      if (method != null) 'method': method,
      'trustDevice': trustDevice,
    });
    final auth = AuthResponse.fromJson(json);
    if (auth.accessToken.isNotEmpty) {
      await _storeTokens(auth.accessToken, auth.refreshToken);
    }
    return auth;
  }

  /// Fetch the current user's MFA status.
  Future<Map<String, dynamic>> getMfaStatus() =>
      _send('GET', _mfaStatusPath, auth: true);

  /// Release the underlying HTTP client.
  void close() => _http.close();

  // --------------------------------------------------------------------------

  Future<void> _storeTokens(String access, String refresh) async {
    if (access.isNotEmpty) await storage.write(_accessKey, access);
    if (refresh.isNotEmpty) await storage.write(_refreshKey, refresh);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    required bool auth,
    bool isRetry = false,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      final token = await storage.read(_accessKey);
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    final http.Response res;
    if (method == 'GET') {
      res = await _http.get(uri, headers: headers);
    } else {
      res = await _http.post(
        uri,
        headers: headers,
        body: body == null ? null : jsonEncode(body),
      );
    }

    // Transparent refresh-and-retry once on 401.
    if (res.statusCode == 401 && auth && !isRetry) {
      final pair = await refresh();
      if (pair != null) {
        return _send(method, path, body: body, auth: auth, isRetry: true);
      }
    }

    final dynamic decoded =
        res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body);

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{'data': decoded};
    }

    final map = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    throw NestAuthException(
      statusCode: res.statusCode,
      message: (map['message'] ?? 'Request failed').toString(),
      code: map['code']?.toString(),
      body: map,
    );
  }
}
