# Change management

<!-- SHARED WIZARDGANG TEMPLATE. Replace Hexframe and HF per project. -->

Every controlled change to Hexframe receives exactly one permanent change ID in the
`HF-###` namespace.

## Identity rules

- One change, one ID. IDs are permanent, never reused, never renumbered after publication.
- A revert keeps the original ID; the revert itself receives a new ID.
- A corrective change references the change it corrects with a `Corrects:` line.

## Commit title

```
[HF-###] [<TYPE>] <imperative summary>
```

One primary type per commit. Secondary consequences belong in the body, not the title.

| Type | Meaning |
| --- | --- |
| `INIT` | Repository or major subsystem foundation |
| `FEAT` | New user-facing or system capability |
| `FIX` | Correction of incorrect behavior |
| `SEC` | Security control, hardening, or vulnerability correction |
| `API` | API contract, endpoint, or integration-interface change |
| `A11Y` | Accessibility behavior or conformance change |
| `I18N` | Internationalization or localization change |
| `AI` | AI capability, model, agent, or AI-governance change |
| `DB` | Database schema, migration, or persistence change |
| `OPS` | Deployment, observability, backup, incident, or runtime control |
| `TEST` | Test coverage, test infrastructure, or verification logic |
| `DOCS` | Material documentation or controlled-record change |
| `REFACTOR` | Structural change with no intended external behavior change |
| `PERF` | Performance or resource-efficiency improvement |
| `BUILD` | Build system, release tooling, CI/CD, or packaging |
| `REVERT` | Explicit reversal of a previous controlled change |
| `CHORE` | Non-functional maintenance fitting no other category |

## Commit body

Rigor scales with risk. A meaningful change carries a controlled change record:

```
[HF-###] [TYPE] <summary>

Change:
<what actually changed>

Reason:
<why the change exists>

Impact:
<subsystems affected>

Risk:
Low | Medium | High

Controls:
- <constraint the change is required to hold>

Validation:
- <command or check actually run>

Evidence:
- <paths that carry the change>

Source:
<original repository / original SHA, for reconstructed changes>

Release:
v0.x.0
```

A low-risk change may use the short form:

```
[HF-062] [FIX] Correct Training menu label

Risk: Low
Validation: npm test
Source: <original SHA>
```

## Risk classification

| Level | Applies to |
| --- | --- |
| **Low** | Documentation, copy, non-authoritative CSS, presentation-only changes, tests, comments |
| **Medium** | Application behavior, game mechanics, new routes, storage behavior, dependencies, format handling, new UI workflows |
| **High** | Authentication, authorization, secrets, production infrastructure, data deletion, persistence schemas, backup/restore, security controls, deployment controls, AI decision authority, privileged administration |

High-risk changes require explicit validation evidence and a documented rollback target.

## Plan / Do / Check / Act

| Phase | Repository evidence |
| --- | --- |
| Plan | Change ID, `Reason:`, `Risk:`, `Controls:` |
| Do | The implementation commit |
| Check | `Validation:`, CI run, review on the pull request |
| Act | Release notes, `docs/history/DEPLOYMENTS.md`, rollback target, corrective changes |

These records are ordinary engineering artifacts. Do not manufacture paperwork that does
not correspond to real activity.
