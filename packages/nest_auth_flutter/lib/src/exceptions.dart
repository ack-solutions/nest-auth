/// Thrown when the backend returns a non-2xx response. Mirrors the nest-auth
/// error envelope: `{ statusCode, message, code }`.
class NestAuthException implements Exception {
  final int statusCode;
  final String message;
  final String? code;
  final Map<String, dynamic>? body;

  const NestAuthException({
    required this.statusCode,
    required this.message,
    this.code,
    this.body,
  });

  @override
  String toString() =>
      'NestAuthException(status: $statusCode, code: ${code ?? '-'}): $message';
}
