---
id: 026
priority: P3
area: release
status: open
package: '@ackplus/nest-auth-react-native'
title: 'react-native CHANGELOG invents patch versions that are never published'
---

## Summary

`@ackplus/nest-auth-react-native` is **not** in the `fixed` group in `.changeset/config.json`, so `changeset version` bumps it independently — usually as a patch, because its only change is a dependency update. But `publish.yml` then sets every package to the **tag** version. The result: its `CHANGELOG.md` carries headings for versions that were never published.

Actual npm versions: `… 2.14.1, 2.15.0, 2.16.0, 2.18.0`.

Headings that existed in its CHANGELOG but not on npm: `2.15.1`, `2.16.1`, `2.16.2`. (`2.16.1` and `2.16.2` were folded into `2.18.0` by hand when the phantom `2.17.0` sections were cleaned up; `2.15.1` and anything older is untouched.)

## Where

- `.changeset/config.json` — the `fixed` group lists the five npm packages but omits `@ackplus/nest-auth-react-native`.
- `packages/nest-auth-react-native/CHANGELOG.md` — the drifted headings.
- `.github/workflows/publish.yml` — `pnpm -r exec npm version <version>` overrides whatever changesets decided.

## Impact

Cosmetic but misleading: a reader picks a version out of the changelog and `npm i` fails. It also means the react-native package's changelog cannot be trusted to answer "which release has this fix?".

## Fix

Add `@ackplus/nest-auth-react-native` to the `fixed` group in `.changeset/config.json`, so changesets bumps it in lockstep with the rest and the headings match what ships. Then its CHANGELOG stops drifting. Historic headings can be left alone or relabelled in one pass.

Worth checking `nest_auth_flutter` for the same drift — it is versioned from `pubspec.yaml` by hand (release step 2), not by changesets.

## Verification

After a release, every `## X.Y.Z` heading in every package CHANGELOG should resolve on npm (or pub.dev). A small script over `registry.npmjs.org` could assert this in CI.

## Related

- [025](025-issue-13-per-request-db-reads-and-cross-instance-staleness.md) — the work during which this surfaced.
