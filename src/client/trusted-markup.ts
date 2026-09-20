/**
 * The single audited trusted-markup parser boundary.
 *
 * Hexframe's build-time documents are React/TSX. Imperative interactive views may
 * produce internal HTML strings, and those strings may be parsed only here. The guard
 * rejects executable/inline-style surfaces before parsing, and repository validation
 * forbids raw DOM HTML sinks anywhere else.
 */
const FORBIDDEN_MARKUP = [
  { label: "script element", pattern: /<script\b/i },
  { label: "style element", pattern: /<style\b/i },
  { label: "inline style attribute", pattern: /\sstyle\s*=\s*["']/i },
  { label: "inline event handler", pattern: /\son[a-z]+\s*=\s*["']/i },
  { label: "javascript URL", pattern: /javascript\s*:/i },
] as const;

export function assertTrustedMarkup(markup: string): void {
  for (const rule of FORBIDDEN_MARKUP) {
    if (rule.pattern.test(markup)) {
      throw new Error(`Rejected trusted markup: ${rule.label}`);
    }
  }
}

function fragmentFor(target: Node, markup: string): DocumentFragment {
  assertTrustedMarkup(markup);
  const document = target.ownerDocument;
  if (!document) throw new Error("Trusted markup target has no owner document");
  const template = document.createElement("template");
  template.innerHTML = markup;
  return template.content;
}

export function replaceTrustedMarkup(target: Element, markup: string): void {
  target.replaceChildren(fragmentFor(target, markup));
}

export function appendTrustedMarkup(target: Element, markup: string): void {
  target.appendChild(fragmentFor(target, markup));
}

export function replaceElementWithTrustedMarkup(target: Element, markup: string): void {
  const parent = target.parentNode;
  if (!parent) return;
  parent.insertBefore(fragmentFor(target, markup), target);
  parent.removeChild(target);
}
