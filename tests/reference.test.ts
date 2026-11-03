import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReferenceCard, ReferenceLook } from "@/components/reference-card";
import { copy } from "@/lib/copy";

const text = copy.en;

describe("reference illustration section", () => {
  it("renders nothing without a grounded suspect", () => {
    expect(renderToStaticMarkup(createElement(ReferenceLook, { text, suspect: "early blight", phase: { kind: "empty" }, onRetry: () => {} }))).toBe(
      "",
    );
    expect(
      renderToStaticMarkup(createElement(ReferenceCard, { plant: "Tomato", suspect: null, symptom: "spots", text })),
    ).toBe("");
    expect(
      renderToStaticMarkup(createElement(ReferenceCard, { plant: "Tomato", suspect: "early blight", symptom: null, text })),
    ).toBe("");
    expect(
      renderToStaticMarkup(
        createElement(ReferenceCard, { plant: "Tomato", suspect: "purple hairy dragon", symptom: "spots", text }),
      ),
    ).toBe("");
  });

  it("shows a loading skeleton that still carries the not-your-plant label", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceLook, { text, suspect: "early blight", phase: { kind: "loading" }, onRetry: () => {} }),
    );
    expect(html).toContain("What to look for");
    expect(html).toContain("not your plant");
    expect(html).toContain("skeleton");
    expect(html).toContain("Drawing the reference");
    expect(html).toContain('aria-busy="true"');
  });

  it("shows a retryable error that keeps the label", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceLook, {
        text,
        suspect: "early blight",
        phase: { kind: "error" },
        onRetry: () => {},
      }),
    );
    expect(html).toContain("not your plant");
    expect(html).toContain("unavailable right now");
    expect(html).toContain("Try again");
    expect(html).toContain("<button");
  });

  it("labels the generated image so it can never read as a diagnosis", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceLook, {
        text,
        suspect: "early blight",
        phase: { kind: "ready", image: "data:image/png;base64,AAA" },
        onRetry: () => {},
      }),
    );
    expect(html).toContain("not your plant");
    expect(html).toContain("data:image/png;base64,AAA");
    expect(html).toContain("Reference illustration of early blight markings");
    expect(html).toContain("How early blight markings can look");
  });

  it("renders the label and caption in Kiswahili", () => {
    const html = renderToStaticMarkup(
      createElement(ReferenceLook, {
        text: copy.sw,
        suspect: "early blight",
        phase: { kind: "ready", image: "data:image/png;base64,AAA" },
        onRetry: () => {},
      }),
    );
    expect(html).toContain("si mmea wako");
    expect(html).toContain("Mchoro wa mfano wa alama za early blight");
  });

  it("starts loading on mount when grounded", () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ image: "data:image/png;base64,AAA" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const html = renderToStaticMarkup(
        createElement(ReferenceCard, { plant: "Tomato", suspect: "early blight", symptom: "spots", text }),
      );
      // Effects do not run in a static render, so the card holds its loading state.
      expect(html).toContain("Drawing the reference");
      expect(html).toContain("not your plant");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
