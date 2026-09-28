# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub's **Report a vulnerability**
advisory flow on this repository. Please do not open a public issue for a suspected
vulnerability.

Include the affected release or commit, what you observed, and the steps to reproduce it.

## What happens next

1. The report is acknowledged and given a permanent change ID in the `HF-###` namespace.
2. Impact is assessed and classified `Low` / `Medium` / `High`.
3. A `[SEC]` change is implemented with tests that fail before the fix and pass after it.
4. A patch release is published.

Published releases are never rewritten to conceal a vulnerability. The release that
contained the defect remains immutable and the correction moves forward:

```
v0.6.0 → issue → [HF-###] [SEC] → tests → v0.6.1
```

## Secrets

No credential of any kind belongs in this repository, in its history, in tests, in
documentation, or in any built asset. This includes API tokens, Cloudflare or GitHub
tokens, passwords, private keys, SSH material, certificates, account identifiers, private
infrastructure hostnames, and private administrative URLs.

Local development has no application credential file. `npm run dev` does not read or create
`.env` or `.dev.vars`; it builds the public application and starts the owned local Worker
directly. Production deployment credentials remain only in the protected GitHub production
environment/provider and are injected by the immutable tag-driven deployment workflow. The
Worker runtime has no application username, password, signing secret, or session binding.
No provider credential is ever sent to the browser or built into an asset.

`npm run check` includes a bounded scan of tracked files and reachable Git history.
It reports credential patterns by path and object ID without printing values. The
scanner permits the empty `.env.example` template, explicit `test-`/`fake-`/
`example` placeholders, and source identifiers or regex syntax that are not
credential values. Its pure cases cover current and historical findings.

## Dependency advisories

`npm run audit:dependencies` is the explicit registry-backed dependency security gate. It runs a read-only `npm audit --json --audit-level=high` against the current dependency graph and committed lockfile. A completed query with no high or critical findings succeeds; high/critical findings fail; and an unavailable, malformed, or otherwise untrustworthy registry response also fails while being reported as an unavailable advisory query rather than as a clean result.

This network-dependent command is intentionally separate from credential-free `npm run check`. Pull-request CI runs both as separately named steps so repository acceptance, advisory findings, and registry/query failures remain distinguishable.

## Supported versions

The most recent minor release receives security fixes. Older `0.x` lines are not
maintained while the project remains pre-1.0.
