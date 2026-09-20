# Licensing review

Hexframe is MIT-licensed. The distributable client includes first-party Hexframe code plus
the runtime libraries declared in `package.json`.

| Surface | Finding |
| --- | --- |
| Runtime dependencies | `react` and `react-dom`, both MIT-licensed and bundled into client output where used. |
| Development dependencies | Vite, Vitest, TypeScript, Wrangler, Ajv, and type packages; build/test tooling rather than runtime product dependencies. |
| Fonts | Referenced by family name only (`Inter`, with system fallbacks). No font file is bundled. |
| Audio | Synthesized at runtime from WebAudio oscillators. No audio asset exists in the repository. |
| Art | `characters/test_fighter/model.svg` is first-party project art. |
| External media | No third-party image, font, audio, or video asset is bundled. |

Dependency and asset licensing must be re-reviewed when runtime dependencies or bundled media
change; this document describes the current repository rather than serving as historical evidence.

Verify:

```bash
node -e "console.log(require('./package.json').dependencies ?? {})"
git ls-files | grep -viE '\.(ts|tsx|js|mjs|json|jsonc|md|css|html)$'
```
