# Implementation plan

## MVP training reset

Owner direction, 2026-09-27: Hexframe is a gameplay-first Training MVP. Training is the only mode, the fixed four-button kit is the combat input surface, Debug is public behind one on-screen toggle, player preferences remain device-local, and the Worker is a small public routing boundary. v0.8.0 is released once this queue is delivered.

Wave rules:

- The kit: ↑ / Y Ember Palm (mid), ← / X Ashen Sweep (low), → / B Frost Heel (overhead), ↓ / A Phoenix Drive (launcher). On hit, Ember Palm → Ashen Sweep → Phoenix Drive.
- Each merge leaves `main` building and Training playable. The required `verify`, `change-id`, and `secrets` checks, `npm run check` as the canonical credential-free gate, squash-only protected `main`, and immutable `v*` tags stay in place.
- No tag, GitHub Release, production deployment, provider secret, or DNS change happens before HF-161.
- Standard validation: pinned `npm ci`, focused tests, `npm run check`, `npm run audit:dependencies`, `git diff --check` over the committed range, exact-head required CI, post-merge CI, and automatic branch deletion.

## Open tasks

### HF-161 — [BUILD] Release v0.8.0

- Dependency: HF-153 through HF-160 delivered, with green post-merge CI on `main`.
- Why: Production still serves v0.7.9 while the completed Training MVP remains unreleased.
- Scope: Set `package.json` and `package-lock.json` to 0.8.0, and retire this task and the wave notes by returning `implementation_plan.md` to the permanent empty template. After merge, create an annotated `v0.8.0` tag on that exact commit and push it so the Release workflow reproduces it, publishes the GitHub Release, and calls the protected deploy.
- Non-goals: Do not deploy outside the tag-driven workflow, move or delete a tag, or change provider secrets.
- Acceptance: The Release workflow passes; the production environment reviewer approves the protected deployment; the deploy verifies the uploaded version is live at 100%; public `version.json` reports v0.8.0 at the tagged commit; `/`, `/play/`, and a retired route behave as expected in production.
- Risk: High. The deploy mutates production and finalizes the reset's destructive storage migration. Treat rollback as a forward corrective release because v0.7.9 predates that migration and cannot restore deleted data.
- Validation: Standard validation, `npm run verify:release-identity -- --tag v0.8.0` after tagging, the Release and Deploy workflow runs, and a production browser check.
- Authorities: `docs/RELEASE-MANAGEMENT.md`, `.github/workflows/release.yml`, `.github/workflows/deploy.yml`, `scripts/deploy.mjs`.
