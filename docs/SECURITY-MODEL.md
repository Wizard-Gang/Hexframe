# Security model

Hexframe is a public browser Training product. Its security model keeps combat authority in the browser, keeps player preferences on the device, and keeps provider credentials outside the application runtime.

## Trust boundaries

| Boundary | What crosses it | Security treatment |
| --- | --- | --- |
| Browser → Worker | Public document, asset, and API-path requests | Untrusted input; route, method, and response-hardening rules apply |
| Browser → device storage | Preferences, Debug visibility | Local convenience state only; grants no server capability |
| Browser → simulation | Player and dummy inputs | Deterministic client-side combat state |
| Release workflow → provider | Protected deployment credentials | Available only inside the governed production path |

Combat is client-side by design. That is not a competitive-integrity claim; there is no authoritative multiplayer or server combat state in the MVP.

## Public surface

The two public product routes are `/` and `/play/`.

The Worker additionally implements boundary behavior rather than product pages:

- `/play` redirects permanently to canonical `/play/` and preserves `?tutorial=1`.
- `/api/*` returns a generic JSON 404.
- Other missing paths return a hardened text 404.
- Static asset requests are rebuilt as bare GETs before Workers Static Assets receives them.

The overview, Training, tutorial, and Debug tools are public. The Worker has no application authentication or session capability.

## Runtime data

The Worker stores no player save, inventory, equipment, progression, identity, application credential, or session. Training constructs its fighter content from bundled authored data.

Tutorial progress lasts only for the current run. Preferences and Debug visibility remain in browser storage. They are not synchronized account data and are not a backup service.

## Response hardening

The Worker applies the repository security headers to routed responses, including:

- Content Security Policy;
- HSTS;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- restrictive Permissions Policy;
- no-referrer policy where the upstream response does not already set one.

Training assets use immutable caching while public documents and boundary responses remain non-cacheable where appropriate.

## Secrets

- Local development needs no application credential file.
- `npm run dev` does not read or create `.env` or `.dev.vars`.
- `wrangler.jsonc` omits the Cloudflare account identifier; the protected deployment environment supplies it.
- Provider credentials remain in protected GitHub/provider state and are injected only into the immutable tag-driven deployment path.
- No provider credential may appear in tracked source, documentation, tests, or built assets.
- CI retains tracked-tree and reachable-history secret scanning.

## Repository and release controls

Protected `main` requires the exact-head `verify`, `change-id`, and `secrets` checks, strict current-with-main status, squash-only merges, and zero bypass actors. Protected `v*` tags cannot be updated or deleted.

Production mutation is release-only. The release workflow validates an immutable annotated semantic-version tag, reproduces it through canonical repository acceptance, publishes the GitHub Release, and calls the protected deployment workflow for that same tag.

## Scope of the model

This model does not claim:

- server enforcement against a player changing their own local simulation;
- cloud synchronization of device-local preferences or tutorial state;
- certification against an external compliance standard.

Security corrections move forward through controlled changes and immutable later releases rather than rewriting published history.
