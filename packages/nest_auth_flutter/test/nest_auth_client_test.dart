// Real, no-mock E2E tests for the Flutter SDK.
//
// Spawns a real nest-auth backend (the built example-nest app) with an
// in-memory sqljs database, then drives NestAuthClient through genuine HTTP
// auth flows. Only the device token storage is in-memory (the real RN/Flutter
// code path); the server, DB, tokens, and HTTP are all real.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

const _password = 'StrongPassword!1';

void main() {
  late Process server;
  late String baseUrl;

  setUpAll(() async {
    final port = await _freePort();
    baseUrl = 'http://127.0.0.1:$port/api';

    server = await Process.start(
      'node',
      ['apps/example-nest/dist/main.js'],
      workingDirectory: _repoRoot(),
      environment: {
        'PORT': '$port',
        'DB_DRIVER': 'sqljs',
        'NODE_ENV': 'test',
        'JWT_SECRET': 'flutter-sdk-test-jwt-secret',
        'TRUSTED_DEVICE_SECRET': 'flutter-sdk-test-trusted-device-secret',
        'ADMIN_CONSOLE_SECRET_KEY': 'flutter-sdk-test-admin-secret',
        'TENANT_MODE': 'disabled',
      },
    );
    // Drain output so the child's stdio buffer never blocks it.
    server.stdout.listen((_) {});
    server.stderr.listen((_) {});

    await _waitForReady(baseUrl);
  });

  tearDownAll(() async {
    server.kill(ProcessSignal.sigterm);
  });

  test('signs up, persists tokens, and reports authenticated', () async {
    final storage = InMemoryTokenStorage();
    final client = NestAuthClient(baseUrl: baseUrl, storage: storage);

    final res = await client.signup(
      email: 'flutter-signup@test.local',
      password: _password,
    );

    expect(res.accessToken, isNotEmpty);
    expect(res.refreshToken, isNotEmpty);
    expect(await client.isAuthenticated, isTrue);
    expect(storage.length, greaterThan(0));
    client.close();
  });

  test('logs in with email and fetches session user data', () async {
    final email = 'flutter-login@test.local';
    final seed = NestAuthClient(baseUrl: baseUrl);
    await seed.signup(email: email, password: _password);
    seed.close();

    // Fresh client (simulates an app restart).
    final client = NestAuthClient(baseUrl: baseUrl);
    final res = await client.loginWithEmail(email, _password);
    expect(res.accessToken, isNotEmpty);
    expect(await client.isAuthenticated, isTrue);

    final user = await client.getSessionUserData();
    expect(user.email, email);
    client.close();
  });

  test('rejects bad credentials', () async {
    final client = NestAuthClient(baseUrl: baseUrl);
    await expectLater(
      client.loginWithEmail('nobody@test.local', 'wrong-password'),
      throwsA(isA<NestAuthException>()),
    );
    expect(await client.isAuthenticated, isFalse);
    client.close();
  });

  test('refreshes the access token', () async {
    final client = NestAuthClient(baseUrl: baseUrl);
    await client.signup(email: 'flutter-refresh@test.local', password: _password);

    final pair = await client.refresh();
    expect(pair, isNotNull);
    expect(pair!.accessToken, isNotEmpty);
    expect(await client.accessToken, pair.accessToken);
    client.close();
  });

  test('logs out and clears the persisted session', () async {
    final storage = InMemoryTokenStorage();
    final client = NestAuthClient(baseUrl: baseUrl, storage: storage);
    await client.signup(email: 'flutter-logout@test.local', password: _password);
    expect(await client.isAuthenticated, isTrue);

    await client.logout();

    expect(await client.isAuthenticated, isFalse);
    expect(await client.accessToken, isNull);
    expect(storage.length, 0);
    client.close();
  });

  test('NestAuthController reflects auth state reactively', () async {
    final controller = NestAuthController(NestAuthClient(baseUrl: baseUrl));
    expect(controller.status, AuthStatus.unknown);
    expect(controller.isAuthenticated, isFalse);

    var notifications = 0;
    controller.addListener(() => notifications++);

    await controller.signup(
      email: 'flutter-ctrl@test.local',
      password: _password,
    );
    expect(controller.status, AuthStatus.authenticated);
    expect(controller.isAuthenticated, isTrue);
    expect(controller.user?.email, 'flutter-ctrl@test.local');
    expect(notifications, greaterThan(0));

    await controller.logout();
    expect(controller.status, AuthStatus.unauthenticated);
    expect(controller.isAuthenticated, isFalse);
    expect(controller.user, isNull);

    controller.client.close();
  });

  test('NestAuthController.restore() loads a persisted session', () async {
    final storage = InMemoryTokenStorage();
    final seed = NestAuthClient(baseUrl: baseUrl, storage: storage);
    await seed.signup(email: 'flutter-restore@test.local', password: _password);
    seed.close();

    // New controller over the same storage — simulates relaunching the app.
    final controller =
        NestAuthController(NestAuthClient(baseUrl: baseUrl, storage: storage));
    expect(controller.status, AuthStatus.unknown);

    await controller.restore();
    expect(controller.isAuthenticated, isTrue);
    expect(controller.user?.email, 'flutter-restore@test.local');

    controller.client.close();
  });
}

Future<int> _freePort() async {
  final socket = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
  final port = socket.port;
  await socket.close();
  return port;
}

/// Tests run from the package dir (packages/nest_auth_flutter) → repo root is
/// two levels up.
String _repoRoot() => Directory.current.parent.parent.path;

Future<void> _waitForReady(String baseUrl) async {
  final client = HttpClient();
  final deadline = DateTime.now().add(const Duration(seconds: 60));
  while (DateTime.now().isBefore(deadline)) {
    try {
      final req = await client.getUrl(Uri.parse('$baseUrl/auth/client-config'));
      final resp = await req.close();
      await resp.drain<void>();
      if (resp.statusCode < 500) {
        client.close();
        return;
      }
    } catch (_) {
      // not listening yet
    }
    await Future<void>.delayed(const Duration(milliseconds: 300));
  }
  client.close();
  throw Exception('example-nest backend did not become ready in time');
}
