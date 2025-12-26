# @ackplus/nest-auth-contracts

Shared interfaces, types, and DTOs for `@ackplus/nest-auth` ecosystem.

## Usage

This package is used as a dependency in projects that need to interact with `nest-auth` APIs but don't need the full NestJS module (e.g., client SDKs, other microservices).

### Installation

```bash
npm install @ackplus/nest-auth-contracts
# or
pnpm add @ackplus/nest-auth-contracts
```

### Importing Types

```typescript
import { 
  IEmailCredentials, 
  INestAuthUser,
  ILoginRequest 
} from '@ackplus/nest-auth-contracts';
```
