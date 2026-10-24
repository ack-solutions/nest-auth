---
"@ackplus/nest-auth-client": patch
---

Fix `attachToAxios` rejecting an axios >= 1.20 instance at compile time. `AxiosLikeInstance.request` was generic (`request<T>(config): Promise<T>`), which conflicts with axios 1.20's `request<T, R>` returning `Promise<AxiosResponseResult<…>>`. It is now `request(config): Promise<unknown>`, which every axios version satisfies. Types only — no runtime change.
