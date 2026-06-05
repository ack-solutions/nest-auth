import 'models.dart';
import 'nest_auth_client.dart';

/// Native sign-in helpers for Google and Apple.
///
/// You obtain the token from the platform's NATIVE sign-in plugin (no browser):
/// `google_sign_in` for Google and `sign_in_with_apple` for Apple. These helpers
/// then exchange that token with your backend and assemble Apple's first-login
/// name for you.
extension NativeSignIn on NestAuthClient {
    /// Exchange a Google **ID token** (from `google_sign_in`) for a session.
    ///
    /// Configure `GoogleSignIn(serverClientId: 'YOUR_WEB_CLIENT_ID...')` so the
    /// ID token's audience matches your backend's `google.clientId` (or a
    /// configured `google.audiences` entry).
    ///
    /// ```dart
    /// final account = await GoogleSignIn(serverClientId: webClientId).signIn();
    /// final auth = await account!.authentication;
    /// await client.signInWithGoogleIdToken(auth.idToken!);
    /// ```
    Future<AuthResponse> signInWithGoogleIdToken(String idToken) =>
        socialLogin('google', idToken, type: 'idToken');

    /// Exchange an Apple **identityToken** (from `sign_in_with_apple`) for a
    /// session. Apple returns the name only on the first sign-in — pass
    /// `givenName`/`familyName` from the credential so the backend can persist it.
    ///
    /// ```dart
    /// final cred = await SignInWithApple.getAppleIDCredential(
    ///   scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
    ///   nonce: nonce,
    /// );
    /// await client.signInWithAppleCredential(
    ///   identityToken: cred.identityToken!,
    ///   givenName: cred.givenName,
    ///   familyName: cred.familyName,
    ///   nonce: rawNonce,
    /// );
    /// ```
    Future<AuthResponse> signInWithAppleCredential({
        required String identityToken,
        String? givenName,
        String? familyName,
        String? nonce,
    }) {
        final parts = [givenName, familyName]
            .where((p) => p != null && p.isNotEmpty)
            .cast<String>();
        final name = parts.isEmpty ? null : parts.join(' ');
        return socialLogin('apple', identityToken, nonce: nonce, name: name);
    }
}
