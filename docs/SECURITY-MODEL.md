# Security model

## Trust boundaries

| Boundary | What crosses it | What is trusted |
| --- | --- | --- |
| Browser → Worker | Save reads and writes, sign-in attempts | Nothing. The signed cookie is verified on every request. |
| Worker → durable storage | One save document per player id | The Worker, which alone can address the object |
| Operator → developer tools | Session cookie from the sign-in route | A valid HMAC-signed, unexpired session |
| Browser → simulation | Inputs | The simulation is client-side and authoritative for combat only |

## Authority

Combat is decided in the browser. This is deliberate and is **not** a trust claim: there is
no competitive server state to protect, and the Worker holds no opinion about whether an
attack hit. If networked matches arrive, they arrive as a Durable Object relaying inputs,
not as authority moving to the server.

What the server *is* authoritative for: **who you are** (a signed player identity) and
**what you own** (the saved document). Those are never decided by the browser.

## Authentication

Two separate identities, deliberately not shared:

**Developer session** — username and password checked against Worker environment values
with a timing-safe comparison, then an HMAC-signed session cookie with an expiry inside the
signed payload. Gates the training and developer tooling routes.

**Player identity** — an opaque random UUID, HMAC-signed with the same secret and verified
timing-safely. It carries no personal data and is not linked to any account. It exists only
to address that player's save.

Both cookies are `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` everywhere except
plain-HTTP localhost, where the attribute would prevent the cookie from being stored at all.

## Secrets

- Local development reads an untracked repository-root `.env`, templated by `.env.example`
  with empty values.
- Production values are Cloudflare Worker secrets, readable only by the server runtime.
- `wrangler.jsonc` deliberately omits the account identifier; it is supplied from the
  environment at deploy time.
- No secret appears in tracked configuration, client code, or any built asset.
- CI fails the build if credential material appears in the tracked tree.

## Predecessor state and recovery boundary

Hexframe is the only supported runtime and persistence namespace for this product.

- Hexframe does not read or migrate predecessor browser-storage keys, identity cookies, or player-save records.
- The former ShadowMoney Worker, hostname, and Durable Object namespace are absent; predecessor saves are not retained or recoverable.
- Recreating a predecessor runtime, hostname, namespace, or importing predecessor data would be a new controlled infrastructure/data-migration change, not a rollback operation.
- Hexframe rollback targets are valid immutable Hexframe release tags only.

## Public versus privileged surface

| Route | Access |
| --- | --- |
| `/`, `/play/` and built assets | Public, no sign-in |
| `/api/save` | Requires a valid signed player identity |
| Training developer tooling | Requires a valid developer session |
| Sign-in page | Publicly reachable by design; it grants nothing without credentials |

Every response carries `x-content-type-options: nosniff` and a `referrer-policy`. Asset
requests are rebuilt as bare GETs so no client cookie is forwarded to the asset server.

## What this model does not claim

- It does not defend against a player modifying their own local simulation. Combat is
  client-side; there is no competitive integrity claim.
- It does not anonymise beyond using an opaque identifier: a save is still a record.
- It makes no certification claim. See the note in `README.md` on standards positioning.
