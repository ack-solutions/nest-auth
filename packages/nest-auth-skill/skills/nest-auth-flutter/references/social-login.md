# Social sign-in (Flutter)

The app gets a token from the provider, the SDK exchanges it with the backend, and the backend creates the session (and the user on first sign-in). The backend needs that provider configured.

## Google

Recommended: the native `google_sign_in` plugin.

```dart nocheck
import 'package:google_sign_in/google_sign_in.dart';
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<void> signInWithGoogle(NestAuthController auth, String webClientId) async {
  final account = await GoogleSignIn(serverClientId: webClientId).signIn();
  if (account == null) return; // cancelled
  final google = await account.authentication;
  final res = await auth.client.signInWithGoogleIdToken(google.idToken!);
  if (!res.isRequiresMfa) await auth.refreshUser();
}
```

`serverClientId` is the **web** client ID that the backend has as `google.clientId` (or lists in `google.audiences`), so the ID token's audience matches. The plugin's API differs between major versions; follow the installed version.

## Apple

```dart nocheck
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<void> signInWithApple(NestAuthController auth) async {
  final cred = await SignInWithApple.getAppleIDCredential(
    scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
  );
  final res = await auth.client.signInWithAppleCredential(
    identityToken: cred.identityToken!,
    givenName: cred.givenName,   // Apple returns the name only on the first authorization
    familyName: cred.familyName,
  );
  if (!res.isRequiresMfa) await auth.refreshUser();
}
```

The backend's `apple.audiences` must include the iOS bundle ID. Pass `nonce:` if the app uses one.

## Any provider, any way of getting the token

```dart
import 'package:nest_auth_flutter/nest_auth_flutter.dart';

Future<AuthResponse> exchange(NestAuthClient client, String provider, String token) =>
    client.socialLogin(provider, token); // 'google', 'github', 'facebook', 'apple', or a custom provider name
```

`socialLogin` also takes `type:` (`'idToken'` or `'accessToken'` for Google), `nonce:`, `firstName:`, `lastName:`, `avatarUrl:`. Other ways to obtain the token: `flutter_appauth`, `flutter_web_auth_2`, Firebase Auth's provider credential, or a web view flow the project already has.

## Notes

- Platform setup (URL schemes, SHA-1 fingerprints, the Sign in with Apple capability) belongs to the plugins; point the user to their setup guides.
- Apple requires offering Sign in with Apple when an iOS app offers other third-party sign-in. Mention it; the choice is the user's.
