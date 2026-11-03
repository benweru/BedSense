import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountSignIn } from "@/components/plant-memory";

describe("one-tap sign-in", () => {
  it("leads with a single button and no phone number field", () => {
    const html = renderToStaticMarkup(createElement(AccountSignIn, { locale: "en" }));
    expect(html).toContain("Save my plants on this phone");
    expect(html).toContain("No number, no code");
    expect(html).toContain("Use email instead");
    expect(html).not.toContain("0712");
    expect(html).not.toContain("SMS");
    expect(html).not.toContain('inputMode="tel"');
  });

  it("renders the one-tap view in Kiswahili", () => {
    const html = renderToStaticMarkup(createElement(AccountSignIn, { locale: "sw" }));
    expect(html).toContain("Hifadhi mimea yangu kwenye simu hii");
    expect(html).toContain("Tumia barua pepe badala yake");
  });

  it("keeps the email code path behind the toggle", () => {
    const html = renderToStaticMarkup(createElement(AccountSignIn, { locale: "en" }));
    // The email form (with its code field) only appears after tapping the toggle.
    expect(html).not.toContain("you@email.com");
    expect(html).not.toContain("Send code");
  });
});
