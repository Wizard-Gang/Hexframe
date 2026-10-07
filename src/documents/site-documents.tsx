import { renderToStaticMarkup } from "react-dom/server";

export type HexframeDocument = "root" | "play";

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
        <p>Enter Training immediately, fight the dummy, then reveal the exact boxes, frames, contacts, save states, and deterministic replay behind the result.</p>
        <div className="overview-actions"><a className="overview-primary" href="/play/">Enter Training →</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">View source ↗</a></div>
      </div>
      <figure className="overview-demo"><figcaption><span>TRAINING STAGE</span><strong>PLAYER + DUMMY</strong></figcaption><div className="overview-training-stage" data-training-stage role="img" aria-label="Hexframe's training stage with the player facing a practice dummy"></div><footer><span>60 HZ COMBAT</span><span>ACTUAL GAME RENDERER</span></footer></figure>
    </section>
    <section className="overview-proof" aria-label="Training lab capabilities"><span>Direct Training</span><span>Public Debug toggle</span><span>Frame step and replay</span><span>Keyboard + gamepad</span></section>
    <section className="overview-sections">
      <article><span>01 / PRACTICE</span><h2>Test the move.</h2><p>Move, attack, block, and repeat against a configurable dummy on the real training stage.</p></article>
      <article><span>02 / INSPECT</span><h2>Read the hit.</h2><p>Turn on Debug without stopping the match, then reveal geometry, frame data, and contact history.</p></article>
      <article><span>03 / REPEAT</span><h2>Reproduce it.</h2><p>Save positions or capture a scenario, then replay the same inputs through the same combat rules.</p></article>
      <article><span>04 / ACCESS</span><h2>Use your controls.</h2><p>Keyboard and gamepad share the fixed four-button kit and can reach the Training controls.</p></article>
    </section>
    <footer className="overview-footer"><span>Wizard Gang · Hexframe</span><a href="https://wizardgang.ai/projects/hexframe/">Case study ↗</a></footer>
  </main>;
}

function TrainingFallback() {
  return <main className="training-bootstrap" id="main" aria-labelledby="training-title">
    <a className="skip-link" href="#training-copy">Skip to Training</a>
    <header><a href="/" aria-label="WizardGang Hexframe home"><Brand /></a><a href="/">Overview</a></header>
    <section id="training-copy">
      <p>HEXFRAME / TRAINING STAGE</p>
      <h1 id="training-title">Training starts here.</h1>
      <p>The deterministic Training session opens directly at <code>/play/</code>. JavaScript enables combat, the always-visible controls, and the public Debug tools.</p>
      <p>Use keyboard or gamepad to practice the fixed four-button kit. Toggle Debug on screen or with <kbd>`</kbd> to inspect frames without stopping the match.</p>
    </section>
  </main>;
}

function RootDocument() {
  return <html lang="en"><head>
    <meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="dark"/>
    <title>Hexframe — Deterministic Fighting-Game Training Lab</title>
    <meta name="description" content="Hexframe is a browser-based fighting-game training lab with deterministic simulation, frame tools, replayable state, and accessible controls."/>
    <link rel="canonical" href="https://hexframe.wizardgang.ai/"/><meta property="og:type" content="website"/><meta property="og:title" content="Hexframe — Deterministic Fighting-Game Training Lab"/><meta property="og:description" content="Fixed-step combat, public Debug tools, replayable state, and accessible controls."/><meta property="og:url" content="https://hexframe.wizardgang.ai/"/>
    <link rel="icon" href={FAVICON}/>
  </head><body><div id="app"><Overview /></div><script type="module" src="/src/client/main.ts"></script></body></html>;
}

function PlayDocument() {
  return <html lang="en"><head>
    <meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="dark"/>
    <title>Hexframe — Training</title><link rel="icon" href={FAVICON}/><link rel="stylesheet" href="/src/client/styles/lab.css"/>
  </head><body><div id="lab" aria-busy="true"><TrainingFallback /></div><script type="module" src="/src/client/lab-main.ts"></script></body></html>;
}

export function renderDocument(document: HexframeDocument): string {
  const markup = document === "root"
    ? renderToStaticMarkup(<RootDocument />)
    : renderToStaticMarkup(<PlayDocument />);
  return `<!doctype html>${markup}`;
}
