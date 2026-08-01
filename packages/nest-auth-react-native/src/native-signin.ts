import type { AuthClient, IAuthResponse } from '@ackplus/nest-auth-client';

/**
 * Native sign-in helpers. They drive the platform's NATIVE Google / Apple flow
 * (no browser / webview), then exchange the resulting token with your backend
 * via `client.socialLogin(...)`.
 *
 * The native module is **injected** so this package carries no native
 * dependency — you install and pass `@react-native-google-signin/google-signin`
 * and `expo-apple-authentication` (or `@invertase/react-native-apple-authentication`)
 * yourself.
 */

/** The subset of `@react-native-google-signin/google-signin` used here. */
export interface GoogleSigninLike {
    hasPlayServices?(options?: unknown): Promise<unknown>;
    signIn(): Promise<unknown>;
}

/**
 * Sign in with the native Google account picker, then exchange the ID token.
 *
 * Configure the native SDK with your **webClientId / serverClientId** so the
 * returned ID token's audience matches your backend's `google.clientId` (or a
 * configured `google.audiences` entry).
 *
 * @example
 * ```ts
 * import { GoogleSignin } from '@react-native-google-signin/google-signin';
 * import { signInWithGoogle } from '@ackplus/nest-auth-react-native';
 *
 * GoogleSignin.configure({ webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com' });
 * await signInWithGoogle(authClient, GoogleSignin);
 * ```
 */
export async function signInWithGoogle(
    client: AuthClient,
    googleSignin: GoogleSigninLike,
): Promise<IAuthResponse> {
    await googleSignin.hasPlayServices?.();
    const result = (await googleSignin.signIn()) as any;
    // The idToken location moved across library versions.
    const idToken: string | undefined =
        result?.data?.idToken ?? result?.idToken ?? result?.user?.idToken;
    if (!idToken) {
        throw new Error(
            'Google Sign-In returned no idToken. Configure the native SDK with your webClientId/serverClientId.',
        );
    }
    return client.socialLogin('google', idToken, { type: 'idToken' });
}

/** The subset of `expo-apple-authentication` / `@invertase/react-native-apple-authentication` used here. */
export interface AppleAuthLike {
    signInAsync(options?: unknown): Promise<unknown>;
    AppleAuthenticationScope?: { FULL_NAME: unknown; EMAIL: unknown };
}

/**
 * Sign in with the native "Sign in with Apple" sheet, then exchange the
 * identityToken. Apple returns the user's name only on the FIRST sign-in; this
 * helper forwards it so the backend can persist it.
 *
 * @example
 * ```ts
 * import * as AppleAuthentication from 'expo-apple-authentication';
 * import { signInWithApple } from '@ackplus/nest-auth-react-native';
 *
 * await signInWithApple(authClient, AppleAuthentication, { nonce });
 * ```
 */
export async function signInWithApple(
    client: AuthClient,
    appleAuth: AppleAuthLike,
    options?: { nonce?: string },
): Promise<IAuthResponse> {
    const requestedScopes = appleAuth.AppleAuthenticationScope
        ? [appleAuth.AppleAuthenticationScope.FULL_NAME, appleAuth.AppleAuthenticationScope.EMAIL]
        : undefined;

    const credential = (await appleAuth.signInAsync({
        requestedScopes,
        nonce: options?.nonce,
    })) as any;

    const identityToken: string | undefined = credential?.identityToken;
    if (!identityToken) {
        throw new Error('Apple Sign-In returned no identityToken.');
    }

    // Apple returns the name (given/family) only on the FIRST sign-in. Forward
    // the parts separately (firstName/lastName) and also as a combined `name` for
    // backward compatibility. Apple provides no avatar.
    const fullName = credential?.fullName;
    const firstName: string | undefined = fullName?.givenName || undefined;
    const lastName: string | undefined = fullName?.familyName || undefined;
    const name = [firstName, lastName].filter(Boolean).join(' ') || undefined;

    return client.socialLogin('apple', identityToken, {
        nonce: options?.nonce,
        name,
        firstName,
        lastName,
    });
}
