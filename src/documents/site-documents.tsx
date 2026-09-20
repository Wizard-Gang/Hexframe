import { renderToStaticMarkup } from "react-dom/server";

export type HexframeDocument = "root" | "lab" | "codex";

const FAVICON = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20fill%3D%22%2308080b%22%2F%3E%3Crect%20x%3D%225%22%20y%3D%2215%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%23d9ff43%22%2F%3E%3Crect%20x%3D%2215%22%20y%3D%225%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%23a489ff%22%2F%3E%3C%2Fsvg%3E";

function Brand() {
  return <><span className="wizardgang-mark" aria-hidden="true"></span><span className="wizardgang-brand-copy"><strong>WIZARDGANG</strong><small>Hexframe</small></span></>;
}

function Overview() {
  return <main className="project-overview" id="main">
    <a className="skip-link" href="#overview-content">Skip to project overview</a>
    <header className="overview-nav">
      <a className="route-brand" href="/" aria-label="WizardGang Hexframe home"><Brand /></a>
      <nav aria-label="Primary"><a href="/" aria-current="page">Overview</a><a href="/play/">Training</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav>
    </header>
    <section className="overview-hero" id="overview-content">
      <div className="overview-copy">
        <p className="overview-kicker">Browser fighting-game lab</p>
        <h1>Practice the hit.<br/><span>Inspect the result.</span></h1>
        <p>Fight a training dummy, pause on contact, and step through the exact frames that decided the hit.</p>
        <div className="overview-actions"><a className="overview-primary" href="/play/">Open training →</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">View source ↗</a></div>
      </div>
      <figure className="overview-demo"><figcaption><span>TRAINING GRID</span><strong>PLAYER + DUMMY</strong></figcaption><div className="overview-training-stage" data-training-stage role="img" aria-label="Hexframe's training stage with the player facing a practice dummy"></div><footer><span>60 HZ COMBAT</span><span>ACTUAL GAME RENDERER</span></footer></figure>
    </section>
    <section className="overview-proof" aria-label="Training lab capabilities"><span>Stage + dummy</span><span>Pause on contact</span><span>Frame step and replay</span><span>Keyboard + gamepad</span></section>
    <section className="overview-sections">
      <article><span>01 / PRACTICE</span><h2>Test the move.</h2><p>Move, attack, block, and repeat against a configurable dummy on the real training stage.</p></article>
      <article><span>02 / INSPECT</span><h2>Read the hit.</h2><p>Pause on contact, advance one frame at a time, and reveal hitboxes, hurtboxes, and pushboxes.</p></article>
      <article><span>03 / REPEAT</span><h2>Reproduce it.</h2><p>Save positions or capture a scenario, then replay the same inputs through the same combat rules.</p></article>
      <article><span>04 / ACCESS</span><h2>Use your controls.</h2><p>Keyboard and gamepad share the same actions, with adjustable text, contrast, motion, and combat feedback.</p></article>
    </section>
    <footer className="overview-footer"><span>Wizard Gang · Hexframe</span><a href="https://wizardgang.ai/projects/hexframe/">Case study ↗</a></footer>
  </main>;
}

function Training() {
  return <main className="route-shell" aria-label="Training">
    <header className="route-global"><a className="route-brand" href="/" aria-label="WizardGang Hexframe home"><Brand /></a><nav aria-label="Primary"><a href="/">OVERVIEW</a><a href="/play/" aria-current="page">TRAINING</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">GITHUB ↗</a></nav></header>
    <header className="route-heading"><a href="/">← Back</a><p>TRAINING</p><h1>Hit the dummy. Inspect the result.</h1></header>
    <section className="training-entry">
      <div className="training-preview"><div className="training-preview-stage" data-training-stage role="img" aria-label="Hexframe's training stage with the player facing a practice dummy"></div><div className="training-preview-labels" aria-hidden="true"><span>PLAYER</span><span>DUMMY</span></div></div>
      <article><div><p>TRAINING LAB</p><h2>One stage. One dummy. Every frame.</h2><span>Learn the controls with a short tutorial or go straight to free practice.</span></div><div className="training-entry-actions"><button type="button" data-launch-training="true">Free practice</button><button className="route-primary" type="button" data-launch-training="true" data-tutorial="true">Start tutorial</button></div></article>
    </section>
  </main>;
}

function CodexFallback() {
  return <main aria-labelledby="codex-fallback-title">
    <p>HEXFRAME / MOVE CODEX</p>
    <h1 id="codex-fallback-title">Authoritative move demonstrations</h1>
    <p>The move catalog and explanatory document are available here; animated frame demonstrations require JavaScript and an authenticated developer session.</p>
    <p><a href="/play/">Return to training</a></p>
  </main>;
}

function RootDocument() {
  return <html lang="en"><head>
    <meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="dark"/>
    <title>Hexframe — Deterministic Fighting-Game Training Lab</title>
    <meta name="description" content="Hexframe is a browser-based fighting-game training lab with deterministic simulation, frame tools, replayable state, and accessible controls."/>
    <link rel="canonical" href="https://hexframe.wizardgang.ai/"/><meta property="og:type" content="website"/><meta property="og:title" content="Hexframe — Deterministic Fighting-Game Training Lab"/><meta property="og:description" content="Fixed-step combat, frame tools, replayable state, and accessible controls."/><meta property="og:url" content="https://hexframe.wizardgang.ai/"/>
    <link rel="icon" href={FAVICON}/>
  </head><body><div id="app"><Overview /></div><script type="module" src="/src/client/main.ts"></script></body></html>;
}

function LabDocument() {
  return <html lang="en"><head>
    <meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="dark"/><meta name="robots" content="noindex"/>
    <title>Hexframe — Training</title><link rel="icon" href={FAVICON}/><link rel="stylesheet" href="/src/client/styles/lab.css"/>
  </head><body><div id="lab"><Training /></div><script type="module" src="/src/client/lab-main.ts"></script></body></html>;
}

function CodexDocument() {
  return <html lang="en"><head>
    <meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="dark"/><meta name="robots" content="noindex, nofollow"/>
    <title>Hexframe — Move Codex</title><link rel="icon" href={FAVICON}/>
  </head><body><div id="codex"><CodexFallback /></div><script type="module" src="/src/client/codex-main.ts"></script></body></html>;
}

export function renderDocument(document: HexframeDocument): string {
  const markup = document === "root"
    ? renderToStaticMarkup(<RootDocument />)
    : document === "lab"
      ? renderToStaticMarkup(<LabDocument />)
      : renderToStaticMarkup(<CodexDocument />);
  return `<!doctype html>${markup}`;
}
