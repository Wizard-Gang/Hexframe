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
      <nav aria-label="Primary"><a href="/" aria-current="page">Overview</a><a href="https://github.com/Wizard-Gang/Hexframe" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav>
    </header>
    <section className="overview-hero" id="overview-content">
      <div className="overview-copy">
        <p className="overview-kicker">A rigged fighting-game proof of concept</p>
        <h1>Small game.<br/><span>Big moves.</span></h1>
        <p>Two fighters, an 11-bone rig and four readable attacks. A small browser playground for bringing a character to life.</p>
        <div className="overview-actions"><a className="overview-primary" href="/play/">Play →</a></div>
        <p className="overview-controls">Desktop browser · Keyboard or gamepad</p>
      </div>
      <figure className="overview-demo">
        <figcaption><span>RIGGING SHOWREEL</span><label hidden data-showreel-controls><input type="checkbox" data-showreel-skeleton /> Skeleton</label></figcaption>
        <div className="overview-training-stage" data-showreel aria-label="Fighter rigging showreel">
          <div className="showreel-fallback"><strong>One rig. Four attacks.</strong><p>Jab, Sweep, Overhead and Uppercut.</p><p>Enable JavaScript to watch the fighter move and reveal its skeleton. Play also requires JavaScript.</p></div>
        </div>
        <footer><span>11 BONES · AUTHORED MOTION</span><span data-showreel-label>Idle → Jab → Sweep → Overhead → Uppercut</span></footer>
      </figure>
    </section>
    <section className="overview-proof" aria-label="Proof of concept"><span>Two rigged fighters</span><span>Four attacks</span><span>Jab → Sweep → Uppercut</span><span>Keyboard + gamepad</span></section>
    <section className="overview-sections">
      <article><span>01 / RIG</span><h2>Bring it to life.</h2><p>Eleven bones drive the body. Toggle Skeleton in the showreel to see how the parts move together.</p></article>
      <article><span>02 / ATTACK</span><h2>Throw a punch.</h2><p>Jab, Sweep, Overhead and Uppercut each have their own motion. Use ↑, ←, → and ↓, or Y, X, B and A on a gamepad.</p></article>
      <article><span>03 / COMBO</span><h2>Link the hits.</h2><p>Land Jab → Sweep → Uppercut to launch the dummy. Walk, jump and block between attacks.</p></article>
      <article><span>04 / PLAY</span><h2>Try the kit.</h2><p>Face the practice dummy on a full-screen stage. Reveal the rig, see the hitboxes or slow down the motion.</p></article>
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
    <title>Hexframe — A Rigged Fighting-Game Proof of Concept</title>
    <meta name="description" content="Two rigged fighters, four readable attacks and a small browser playground. Watch the rigging showreel, then play with keyboard or gamepad."/>
    <link rel="canonical" href="https://hexframe.wizardgang.ai/"/><meta property="og:type" content="website"/><meta property="og:title" content="Hexframe — A Rigged Fighting-Game Proof of Concept"/><meta property="og:description" content="Two rigged fighters, an 11-bone rig and four readable attacks."/><meta property="og:url" content="https://hexframe.wizardgang.ai/"/>
    <link rel="icon" href={FAVICON}/><link rel="stylesheet" href="/src/client/styles/front.css"/>
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
