# Real-test helpers

This directory is populated by Phase 1 tasks (T-011 through T-021) with the helpers that implement the [no-mock policy](../../../.tasks/test-catalog.md#no-mock-policy).

## Planned files

| File | Owner task | Purpose |
|---|---|---|
| `postgres-container.ts` | T-012 | Per-suite Postgres container via Testcontainers, truncated between tests |
| `redis-container.ts` | T-013 | Per-suite Redis container |
| `boot-test-app.ts` | T-014 | Real `Test.createTestingModule + app.init()` → `INestApplication` |
| `oauth-stub-server.ts` | T-015 | Real Express stub on random port implementing Google/GitHub/Facebook/Apple shapes |
| `email-capture.transport.ts` | T-016 | Real `EmailSender` impl writing to in-memory store for assertions |
| `sms-capture.transport.ts` | T-017 | Real `SmsSender` impl writing to in-memory store |
| `fake-timers.ts` | T-018 | `@sinonjs/fake-timers` helper for narrow expiry tests |
| `boot-client-against-backend.ts` | T-021 | Boot real backend in-process; return configured `AuthClient` |

## Hard rule

These are **real implementations of ports**, not Jest mocks. The OAuth stub is a real HTTP server. The email transport is a real `EmailSender` that just stores messages in memory instead of calling SMTP. The test reaches into the store to assert.

No file in this directory may import from `vi.mock`, `jest.mock`, or define `MockRepository`-style classes. See [`test-catalog.md`](../../../.tasks/test-catalog.md) §No-mock policy.
