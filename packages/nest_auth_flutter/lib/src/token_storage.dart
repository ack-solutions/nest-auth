/// Persists the access / refresh tokens. Implement this to back the client with
/// any store; [InMemoryTokenStorage] and `SecureTokenStorage` are provided.
abstract class TokenStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Non-persistent storage — tokens live only for the lifetime of the process.
/// Useful for tests or ephemeral sessions.
class InMemoryTokenStorage implements TokenStorage {
  final Map<String, String> _store = {};

  @override
  Future<String?> read(String key) async => _store[key];

  @override
  Future<void> write(String key, String value) async {
    _store[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _store.remove(key);
  }

  /// Number of stored entries (handy in tests).
  int get length => _store.length;
}
