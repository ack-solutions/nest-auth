# @ackplus/nest-auth-client

Framework-agnostic JS/TS client for [`@ackplus/nest-auth`](https://www.npmjs.com/package/@ackplus/nest-auth). Works in browsers, Node, React Native, Cloudflare Workers, Deno, Bun.

## Documentation

**Full reference at [ack-solutions.github.io/nest-auth/docs/client](https://ack-solutions.github.io/nest-auth/docs/client).**

- [`AuthClient`](https://ack-solutions.github.io/nest-auth/docs/client/client) — every method
- [Config](https://ack-solutions.github.io/nest-auth/docs/client/config)
- [Storage Adapters](https://ack-solutions.github.io/nest-auth/docs/client/storage-adapters) — Memory / LocalStorage / SessionStorage / Cookie / custom
- [HTTP Adapters](https://ack-solutions.github.io/nest-auth/docs/client/http-adapters) — Fetch (default) / Axios / custom
- [Events](https://ack-solutions.github.io/nest-auth/docs/client/events)
- [Utilities](https://ack-solutions.github.io/nest-auth/docs/client/utilities) — `decodeJwt`, `hasRole`, `hasPermission`, etc.

## Install

```bash
pnpm add @ackplus/nest-auth-client
```

No peer dependencies.

## Minimal example

```ts
import { AuthClient } from '@ackplus/nest-auth-client';

const auth = new AuthClient({
  baseUrl: 'https://api.example.com',
});

await auth.signup({ email, password, firstName: 'Alice' });
await auth.login({ credentials: { email, password } });

if (auth.getIsAuthenticated()) {
  const user = await auth.getSessionUserData();
}
```

See the [vanilla quickstart](https://ack-solutions.github.io/nest-auth/docs/getting-started/quickstart-vanilla) for Vue / Angular / React Native examples.

## License

MIT
