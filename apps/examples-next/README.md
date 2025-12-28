# Nest Auth Next.js Example

This example demonstrates a complete integration of `@ackplus/nest-auth-client` and `@ackplus/nest-auth-react` in a Next.js App Router application.

## Features

- **Full Auth Flow**: Login, Signup, Forgot/Reset Password, Logout.
- **SSR Support**: Protected routes via Middleware and Server Components.
- **Secure**: Uses `HttpOnly` cookies for token storage (configurable).
- **Type Safe**: Full TypeScript integration.
- **Clean UI**: Built with Tailwind CSS and Lucide icons.

## Setup

1.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

2.  **Environment Setup**:
    Create `.env.local` (or ensure defaults work):
    ```bash
    NEXT_PUBLIC_API_URL="http://localhost:3000/api"
    ```
    *Note: Adjust URL to point to your `nest-auth` backend.*

3.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

## Project Structure

- `app/(auth)/`: Authentication pages (Login, Signup, etc.).
- `app/(dashboard)/`: Protected pages (Dashboard, Profile).
- `lib/auth.ts`: Shared auth configuration (Client & Server).
- `middleware.ts`: Route protection middleware using cookie check.
- `providers/auth-provider.tsx`: Client-side provider wrapper.

## Key Integration Points

### Auth Provider
To enable auth hooks (`useNestAuth`), wrap your app in `AuthProvider`:
```tsx
// app/layout.tsx
import { AuthProvider } from '@/providers/auth-provider';

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
       {children}
    </AuthProvider>
  );
}
```

### SSR & Middleware
Server-side auth extraction is handled via `createNextAuthHelpers` in `lib/auth.ts`.
Middleware protects routes by checking for the `access_token` cookie.

### API Calls
The `AuthClient` automatically attaches the access token to requests. See `components/demo/api-call.tsx` for an example.
