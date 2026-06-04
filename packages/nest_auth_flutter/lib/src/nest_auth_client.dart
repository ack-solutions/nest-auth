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
  Future<AuthResponse> socialLogin(
    String providerName,
    String token, {
    String? type,
  }) =>
      login(
        providerName: providerName,
        credentials: {'token': token, if (type != null) 'type': type},
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
