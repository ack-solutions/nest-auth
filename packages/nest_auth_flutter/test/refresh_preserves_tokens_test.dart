// Regression: refresh() must NEVER destroy stored tokens on an INDETERMINATE
// failure — a session may only be ended by a definitive server rejection
// (401/403). A 502 (server error) and a SocketException (network failure) must
// leave the stored access/refresh tokens readable so the app can retry.
//
// NO MOCKS. A real dart:io HttpServer returns the 502; a real closed port
// produces the SocketException. Real client, real HTTP, in-memory token store.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

void main() {
  InMemoryTokenStorage seededStorage() {
    final storage = InMemoryTokenStorage();
    storage.write('accessToken', 'seeded-access-token');
    storage.write('refreshToken', 'seeded-refresh-token');
    return storage;
  }

  test('a 502 during refresh leaves stored tokens readable (no logout)', () async {
    final server = await HttpServer.bind('127.0.0.1', 0);
    server.listen((HttpRequest req) {
      req.response.statusCode = 502;
      req.response.headers.contentType = ContentType.json;
      req.response.write('{"message":"bad gateway"}');
      req.response.close();
    });
    addTearDown(() => server.close(force: true));

    final storage = seededStorage();
    final client = NestAuthClient(baseUrl: 'http://127.0.0.1:${server.port}', storage: storage);

    await expectLater(client.refresh(), throwsA(isA<NestAuthException>()));

    // Tokens must survive an indeterminate failure.
    expect(await storage.read('refreshToken'), 'seeded-refresh-token');
    expect(await storage.read('accessToken'), 'seeded-access-token');
  });

  test('a SocketException during refresh leaves stored tokens readable (no logout)', () async {
    // Grab a port, then free it so a connection is refused → SocketException.
    final probe = await ServerSocket.bind('127.0.0.1', 0);
    final deadPort = probe.port;
    await probe.close();

    final storage = seededStorage();
    final client = NestAuthClient(baseUrl: 'http://127.0.0.1:$deadPort', storage: storage);

    await expectLater(client.refresh(), throwsA(isA<SocketException>()));

    expect(await storage.read('refreshToken'), 'seeded-refresh-token');
    expect(await storage.read('accessToken'), 'seeded-access-token');
  });
}
