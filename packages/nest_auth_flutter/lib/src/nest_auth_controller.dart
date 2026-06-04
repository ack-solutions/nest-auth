import 'package:flutter/foundation.dart';

import 'models.dart';
import 'nest_auth_client.dart';

/// Coarse authentication state for driving your widget tree.
enum AuthStatus {
  /// Not determined yet — call [NestAuthController.restore] on app start.
  unknown,

  /// A valid session is present.
  authenticated,

  /// No session.
  unauthenticated,
}

/// A reactive wrapper around [NestAuthClient] for Flutter apps.
///
/// It is a [ChangeNotifier], so widgets rebuild automatically when the user
/// signs in or out. Drive your root with a `ListenableBuilder`:
///
/// ```dart
/// final auth = NestAuthController(
///   NestAuthClient(baseUrl: '...', storage: SecureTokenStorage()),
/// );
/// await auth.restore(); // on app start
///
/// ListenableBuilder(
///   listenable: auth,
///   builder: (context, _) {
///     if (auth.status == AuthStatus.unknown) return const SplashScreen();
///     return auth.isAuthenticated ? const HomeScreen() : LoginScreen(auth: auth);
///   },
/// );
/// ```
class NestAuthController extends ChangeNotifier {
  final NestAuthClient client;

  NestAuthController(this.client);

  AuthStatus _status = AuthStatus.unknown;
  SessionUser? _user;
  bool _busy = false;
  Object? _lastError;

  /// Current coarse auth state.
  AuthStatus get status => _status;

  /// The signed-in user, or null.
  SessionUser? get user => _user;

  /// Convenience: `status == authenticated`.
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  /// True while a sign-in / sign-up / sign-out call is in flight.
  bool get isBusy => _busy;

  /// The error thrown by the most recent action (cleared when a new one starts).
  Object? get lastError => _lastError;

  /// Restore a persisted session on app start: if tokens exist, load the user.
  Future<void> restore() async {
    if (await client.isAuthenticated) {
      try {
        await _loadUser(notify: false);
      } catch (_) {
        _status = AuthStatus.unauthenticated;
      }
    } else {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  /// Register a new account; transitions to [AuthStatus.authenticated] on success.
  Future<void> signup({
    String? email,
    String? phone,
    required String password,
  }) =>
      _run(() async {
        await client.signup(email: email, phone: phone, password: password);
        await _loadUser(notify: false);
      });

  /// Log in with a provider (default `email`).
  Future<void> login({
    String providerName = 'email',
    required Map<String, dynamic> credentials,
  }) =>
      _run(() async {
        await client.login(providerName: providerName, credentials: credentials);
        await _loadUser(notify: false);
      });

  /// Convenience email/password login.
  Future<void> loginWithEmail(String email, String password) =>
      login(credentials: {'email': email, 'password': password});

  /// Log out and transition to [AuthStatus.unauthenticated].
  Future<void> logout() => _run(() async {
        await client.logout();
        _user = null;
        _status = AuthStatus.unauthenticated;
      });

  /// Re-fetch the current user (e.g. after a profile update).
  Future<void> refreshUser() async {
    await _loadUser();
  }

  // ---------------------------------------------------------------------------

  Future<void> _loadUser({bool notify = true}) async {
    _user = await client.getSessionUserData();
    _status = AuthStatus.authenticated;
    if (notify) notifyListeners();
  }

  Future<void> _run(Future<void> Function() action) async {
    _busy = true;
    _lastError = null;
    notifyListeners();
    try {
      await action();
    } catch (e) {
      _lastError = e;
      rethrow;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
