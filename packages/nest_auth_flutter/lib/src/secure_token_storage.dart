import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'token_storage.dart';

/// A [TokenStorage] backed by `flutter_secure_storage` — tokens are kept in the
/// platform keychain / keystore. Recommended for production apps.
///
/// ```dart
/// final client = NestAuthClient(
///   baseUrl: 'https://api.example.com',
///   storage: SecureTokenStorage(),
/// );
/// ```
class SecureTokenStorage implements TokenStorage {
  final FlutterSecureStorage _storage;
  final String prefix;

  SecureTokenStorage({
    FlutterSecureStorage? storage,
    this.prefix = 'nest_auth.',
  }) : _storage = storage ?? const FlutterSecureStorage();

  String _key(String key) => '$prefix$key';

  @override
  Future<String?> read(String key) => _storage.read(key: _key(key));

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: _key(key), value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: _key(key));
}
