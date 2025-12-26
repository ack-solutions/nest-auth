# @ackplus/nest-auth-react

React SDK for `@ackplus/nest-auth`. Provides hooks and components for easy authentication integration in React applications.

> **Note:** This package is designed to work with the `@ackplus/nest-auth` backend module. Make sure your API is set up with it.

## Features

- 🪝 **useAuth Hook** - Easy access to user, login, logout, and token state.
- 🔒 **Protected Routes** - Helper components for auth guarding.
- 🔄 **Auto Refresh** - Handles token refresh automatically (coming soon).

## Installation

```bash
npm install @ackplus/nest-auth-react
# or
pnpm add @ackplus/nest-auth-react
```

## Quick Start

1. Wrap your app in `AuthProvider`:

```tsx
import { AuthProvider } from '@ackplus/nest-auth-react';

function App() {
  return (
    <AuthProvider config={{ apiUrl: 'http://localhost:3000' }}>
      <YourApp />
    </AuthProvider>
  );
}
```

2. Use hooks in your components:

```tsx
import { useAuth } from '@ackplus/nest-auth-react';

function UserProfile() {
  const { user, login, logout } = useAuth();

  if (!user) {
    return <button onClick={() => login(credentials)}>Login</button>;
  }

  return (
    <div>
      <h1>Welcome, {{user.firstName}}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Related Packages

- [@ackplus/nest-auth](../nest-auth) - The backend NestJS module.
- [@ackplus/nest-auth-client](../nest-auth-client) - The underlying JS client.
