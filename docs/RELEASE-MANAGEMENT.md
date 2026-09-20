# Release management

<!-- SHARED WIZARDGANG TEMPLATE. Replace Hexframe and HF per project. -->

## Versioning

Hexframe uses semantic versioning and remains in `0.x.x` until it is intentionally
declared stable.

| Component | Meaning |
| --- | --- |
| MAJOR | Breaking or stable product generation change |
| MINOR | Meaningful new capability or architectural milestone |
| PATCH | Compatible defect, security, or maintenance release |

Change IDs identify individual controlled changes. Release tags identify reproducible
product states. **Not every change ID is tagged.**

## The release rule

A release tag may only exist if checking out that tag reproduces that product state:

```
git checkout v0.x.x
npm ci
npm test
npm run typecheck
npm run build
```

If a historical state cannot be reproduced, record it as a milestone in
`docs/history/` — do not tag it as a release.

## Release notes

Every release records:

```
Product
Version
Release date
Commit SHA
Scope
Included change IDs
Validation
Deployment
Known limitations
Previous release
Rollback target
```

Release records are immutable historical evidence. Published tags are never moved and
published release history is never deleted.

## Release flow

```
merge to main → CI → release candidate → tag v0.x.x → release validation
              → production deployment of that exact SHA
```

Production is tied to an immutable release identity, not to arbitrary `main` commits.

## Production mutation boundary

Production mutation is supported only by the tag-driven GitHub Actions release path.

- The release trigger is a pushed annotated `v*` tag.
- The tag must equal `v<package.json version>`.
- The tagged commit and checked-out deployment commit must be identical.
- `.github/workflows/deploy.yml` is callable only from the release workflow; it has no manual dispatch or branch trigger.
- The deploy job runs inside the protected `production` GitHub environment.
- Merges to `main`, pull requests, branches, and local development never deploy production.
- `npm run deploy:dry-run` may build and ask Wrangler to validate the production configuration with `--dry-run`; it cannot publish.
- Production secret values are maintained in protected provider/GitHub environment state. Local repository scripts do not push them.

## Security corrections

A vulnerability in a published release is corrected forward, never by rewriting the
release that contained it:

```
v0.6.0 → issue discovered → [HF-###] [SEC] ... → tests → v0.6.1
```
