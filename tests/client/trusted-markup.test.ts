import { describe, expect, it } from "vitest";
import { assertTrustedMarkup } from "../../src/client/trusted-markup";

describe("trusted markup boundary", () => {
  it("accepts inert application markup", () => {
    expect(() => assertTrustedMarkup('<button type="button" data-action="play">Play</button>')).not.toThrow();
  });

  it.each([
    ['<script>alert(1)</script>', "script element"],
    ['<style>body{display:none}</style>', "style element"],
    ['<div style="display:none">x</div>', "inline style attribute"],
    ['<button onclick="alert(1)">x</button>', "inline event handler"],
    ['<a href="javascript:alert(1)">x</a>', "javascript URL"],
  ])("rejects %s", (markup, message) => {
    expect(() => assertTrustedMarkup(markup)).toThrow(message);
  });
});
