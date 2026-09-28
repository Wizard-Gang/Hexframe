# Security model

## Trust boundaries

| Boundary | What crosses it | What is trusted |
| --- | --- | --- |
| Browser → Worker | Public document, asset and API requests | Nothing. The Worker applies routing and response hardening before serving or rejecting a request. |
| Browser → device storage | Preferences, tutorial progress and Debug visibility | Device-local state only; it grants no server capability. |
| Browser → simulation | Inputs | The simulation is client-side and authoritative for combat only. |

## Authority

Combat is decided in the browser. This is deliberate and is **not** a trust claim: there is
no competitive server state to protect, and the Worker holds no opinion about whether an
attack hit.

The Worker stores no player saves, inventory, equipment, progression, identity, application
credentials or sessions. Training constructs the Test Fighter from bundled authored content.
Preferences, tutorial progress and Debug visibility remain only on the device.

## Authentication

Hexframe has no application authentication surface. The overview, Training, Debug tools and
their built assets are public. Requests under `/api/*` return the same JSON 404 boundary;
there is no server capability to acquire through a cookie or credential.

## Secrets

- Local development requires no application credential file and `npm run dev` does not
  read or create `.env` or `.dev.vars`.
- Production deployment credentials remain in the protected GitHub production environment
  and provider. They are injected only into the immutable tag-driven deploy workflow.
- `wrangler.jsonc` deliberately omits the account identifier; the protected deploy
  environment supplies it when a release is deployed.
- No provider secret appears in tracked configuration, client code or any built asset.
- CI retains tracked-tree and reachable-history secret scanning.

## Public surface

| Route | Behavior |
| --- | --- |
| `/` | Public project overview |
| `/play` | Permanent redirect to canonical `/play/`, preserving `?tutorial=1` |
| `/play/` and `/play/assets/*` | Public Training document and built assets |
| `/api/*` | Generic JSON 404 |
| Other missing paths | Hardened text 404 from the static routing boundary |

Every response carries the Worker's transport, framing, capability, content-type,
referrer and content-security hardening. Asset requests are rebuilt as bare GETs before
Workers Static Assets receives them, so browser cookies and other request headers are not
forwarded to the asset server.

## What this model does not claim

- It does not defend against a player modifying their own local simulation. Combat is
  client-side; there is no competitive integrity claim.
- Device-local preferences, tutorial progress and Debug visibility are browser storage, not
  synchronized account data or a backup service.
- It makes no certification claim.
