# @ackplus/nest-auth-client

The official JavaScript/TypeScript client SDK for `@ackplus/nest-auth`.

## Features

- 🔄 **Framework Agnostic** - Works in React, Vue, Angular, React Native, or vanilla JS.
- 💾 **Storage Adapters** - Built-in support for `localStorage`, `sessionStorage`, `AsyncStorage`, and Cookies.
- 🔄 **Auto Refresh** - Automatically handles JWT refresh token rotation silently.
- 📡 **HTTP Client** - Configurable HTTP client with interceptors.
- 🔐 **Type-Safe** - Full TypeScript support sharing types with the backend.

## Installation

```bash
npm install @ackplus/nest-auth-client
# or
pnpm add @ackplus/nest-auth-client
```

## Quick Start

### 1. Initialize Client

```typescript
import { createAuthClient } from '@ackplus/nest-auth-client';

export const authClient = createAuthClient({
  apiUrl: 'http://localhost:3000',
  storage: 'local', // or 'cookie', 'memory'
});
```

### 2. Login

```typescript
try {
  const { user, tokens } = await authClient.login({
    email: 'user@example.com',
    password: 'password123',
  });
  
  console.log('Logged in user:', user);
} catch (error) {
  console.error('Login failed:', error);
}
```

### 3. Make Authenticated Requests

The client ensures the access token is attached and refreshed automatically using its internal HTTP client.

```typescript
const response = await authClient.http.get('/profile');
```

## Advanced Usage

### Custom Storage (e.g., React Native)

```typescript
import { createAuthClient } from '@ackplus/nest-auth-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const authClient = createAuthClient({
  apiUrl: 'https://api.myapp.com',
  storage: {
    msg: 'async-storage',
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
    removeItem: AsyncStorage.removeItem,
  },
});
```

### Event Listening

```typescript
authClient.on('login', (user) => {
  console.log('User just logged in', user);
});

authClient.on('logout', () => {
  console.log('User logged out');
  // Redirect to login page
});
```

## Related Packages

- [@ackplus/nest-auth](../nest-auth) - The backend module.
- [@ackplus/nest-auth-react](../nest-auth-react) - React hooks for this client.
- [@ackplus/nest-auth-contracts](../nest-auth-contracts) - Shared types.
