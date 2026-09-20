# Hexframe

Hexframe is a browser-based fighting-game training lab. It combines fixed-step combat, authored frame data, replayable state, keyboard and gamepad controls, and integrated training tools.

**[Overview](https://hexframe.wizardgang.ai)** · **[Training](https://hexframe.wizardgang.ai/play/)** · **[Case study](https://wizardgang.ai/projects/hexframe/)**

## Run locally

```bash
npm ci
cp .env.example .env
npm run dev
```

The root route serves the project overview. `/play/` opens the training setup, and `/lab/` is the authenticated developer entry.

## Verify

```bash
npm run check
```

## Structure

- `src/combat/` contains the deterministic combat model.
- `src/game/` and `src/rollback/` contain sessions, snapshots, and replay contracts.
- `src/lab/` contains the training interface and simulation tools.
- `src/client/` contains browser entry points and presentation.
- `src/worker/` contains routing, authentication, and player-save APIs.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Release management](docs/RELEASE-MANAGEMENT.md)

## Deployment

Production releases are deployed from exact semantic-version tags. The running release is published at [version.json](https://hexframe.wizardgang.ai/version.json).
