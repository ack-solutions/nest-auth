/// A pair of access + refresh tokens returned by the backend.
class TokenPair {
  final String accessToken;
  final String refreshToken;

  const TokenPair({required this.accessToken, required this.refreshToken});
}

/// The serialized session user (`GET /auth/me`). The full payload is kept on
/// [raw] so app-specific fields added via `getSessionUserData` hooks are
/// available without a typed model.
class SessionUser {
  final String id;
  final String? email;
  final String? phone;
  final Map<String, dynamic> raw;

  const SessionUser({
    required this.id,
    this.email,
    this.phone,
    required this.raw,
  });

  factory SessionUser.fromJson(Map<String, dynamic> json) => SessionUser(
        id: json['id']?.toString() ?? '',
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        raw: json,
      );
}

/// The result of a `login` / `signup` call.
class AuthResponse {
  final String accessToken;
  final String refreshToken;
  final bool isRequiresMfa;
  final Map<String, dynamic> raw;

  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.isRequiresMfa,
    required this.raw,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) => AuthResponse(
        accessToken: json['accessToken'] as String? ?? '',
        refreshToken: json['refreshToken'] as String? ?? '',
        isRequiresMfa: json['isRequiresMfa'] as bool? ?? false,
        raw: json,
      );
}
