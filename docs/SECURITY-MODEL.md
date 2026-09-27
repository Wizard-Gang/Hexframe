# Security model

## Trust boundaries

| Boundary | What crosses it | What is trusted |
| --- | --- | --- |
| Browser → Worker | Static requests, sign-in attempts and protected developer API calls | Nothing. Protected routes verify the developer session on every request. |
| Browser → device storage | Preferences and tutorial progress | Device-local state only; it grants no server capability. |
| Browser → simulation | Inputs | The simulation is client-side and authoritative for combat only. |
| Operator → developer tools | Session cookie from the sign-in route | A valid HMAC-signed, unexpired session. |

## Authority

Combat is decided in the browser. This is deliberate and is **not** a trust claim: there is
no competitive server state to protect, and the Worker holds no opinion about whether an
attack hit.

The Worker no longer stores player saves, inventory, equipment, progression, loadout presets
or a player identity. Training constructs the Test Fighter from bundled authored content.
Preferences and tutorial progress are stored only on the device. The remaining server-side
authority is limited to access to the private developer surface until that surface is retired.

## Authentication

**Developer session** — username and password are checked against Worker environment values
with a timing-safe comparison, then an HMAC-signed session cookie with an expiry inside the
signed payload. It gates the private developer tooling routes.

The session cookie is `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` everywhere
except plain-HTTP localhost, where the attribute would prevent the cookie from being stored.

There is no separate player identity cookie.

## Secrets

- Local development reads an untracked repository-root `.env`, templated by `.env.example`
  with empty values.
- Production values are Cloudflare Worker secrets, readable only by the server runtime.
- `wrangler.jsonc` deliberately omits the account identifier; it is supplied from the
  environment at deploy time.
- No secret appears in tracked configuration, client code, or any built asset.
- CI fails the build if credential material appears in the tracked tree.

## Public versus privileged surface

| Route | Access |
| --- | --- |
| `/`, `/play/` and built assets | Public, no sign-in |
| `/api/save` and former save subpaths | Generic JSON API 404 |
| Training developer tooling and `/api/lab/*` | Requires a valid developer session |
| Sign-in page | Publicly reachable by design; it grants nothing without credentials |

Every response carries `x-content-type-options: nosniff` and a `referrer-policy`. Asset
requests are rebuilt as bare GETs so no client cookie is forwarded to the asset server.

## What this model does not claim

- It does not defend against a player modifying their own local simulation. Combat is
  client-side; there is no competitive integrity claim.
- Device-local preferences and tutorial progress are browser storage, not synchronized
  account data or a backup service.
- It makes no certification claim.
