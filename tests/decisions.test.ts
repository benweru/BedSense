import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatThread } from "@/components/chat-thread";
import { decisionText, threadWithDecision } from "@/lib/decisions";
import type { AskTurn } from "@/lib/types";

describe("agent decision records", () => {
  it("words each decision as what happened and why", () => {
    expect(decisionText("en", "worsening", "Check the bed today.")).toBe("Worsening detected → suggested: Check the bed today.");
    expect(decisionText("en", "overdue", "Re-check the bed.")).toBe("Re-check overdue → suggested: Re-check the bed.");
    expect(decisionText("en", "photo_requested", "a close photo of the worst leaf")).toBe(
      "Evidence stale → asked for a fresh photo (a close photo of the worst leaf).",
    );
    expect(decisionText("en", "photo_answered", "")).toBe("Fresh photo received → answered from the new photo.");
  });

  it("records decisions in Kiswahili for Swahili checks", () => {
    expect(decisionText("sw", "photo_requested", "picha ya karibu")).toContain("niliomba picha mpya");
    expect(decisionText("sw", "worsening", "Kagua shamba leo.")).toContain("Kuzorota kumegunduliwa");
  });

  it("cleans and caps a noisy model reason", () => {
    expect(decisionText("en", "photo_requested", "  snap\nthe   leaf  ")).toContain("(snap the leaf).");
    expect(decisionText("en", "worsening", "x".repeat(400)).length).toBeLessThan(220);
  });

  it("appends a system turn once and never duplicates it", () => {
    const thread: AskTurn[] = [{ role: "farmer", text: "Is it spreading?" }];
    const next = threadWithDecision(thread, "en", "photo_requested", "a close photo");
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ role: "system", text: "Evidence stale → asked for a fresh photo (a close photo)." });
    // The original thread is untouched and a repeat record is a no-op returning the same array.
    expect(thread).toHaveLength(1);
    expect(threadWithDecision(next, "en", "photo_requested", "a close photo")).toBe(next);
  });

  it("keeps distinct decisions side by side", () => {
    const thread: AskTurn[] = [];
    const next = threadWithDecision(
      threadWithDecision(thread, "en", "photo_requested", "a close photo"),
      "en",
      "photo_answered",
      "",
    );
    expect(next.map((turn) => turn.role)).toEqual(["system", "system"]);
    expect(next[0]?.text).toContain("asked for a fresh photo");
    expect(next[1]?.text).toContain("answered from the new photo");
  });
});

describe("thread rendering", () => {
  const thread: AskTurn[] = [
    { role: "farmer", text: "Is it spreading?" },
    { role: "system", text: "Evidence stale → asked for a fresh photo (a close photo)." },
    { role: "bedsense", text: "Take a close photo and send it here." },
  ];

  it("renders system decisions distinctly from farmer and BedSense turns", () => {
    const html = renderToStaticMarkup(createElement(ChatThread, { thread }));
    expect(html).toContain("Evidence stale → asked for a fresh photo");
    const items = html.split("</li>");
    const system = items.find((item) => item.includes("Evidence stale")) ?? "";
    const farmer = items.find((item) => item.includes("Is it spreading?")) ?? "";
    const bedsense = items.find((item) => item.includes("Take a close photo")) ?? "";
    expect(system).toContain("border-dashed");
    expect(farmer).toContain("border-leaf/40");
    expect(bedsense).toContain("bg-field");
    expect(farmer).not.toContain("border-dashed");
    expect(bedsense).not.toContain("border-dashed");
  });

  it("keeps turn order so the trace reads top to bottom", () => {
    const html = renderToStaticMarkup(createElement(ChatThread, { thread }));
    const farmerAt = html.indexOf("Is it spreading?");
    const systemAt = html.indexOf("Evidence stale");
    const bedsenseAt = html.indexOf("Take a close photo");
    expect(farmerAt).toBeLessThan(systemAt);
    expect(systemAt).toBeLessThan(bedsenseAt);
  });

  it("renders nothing for an empty thread", () => {
    expect(renderToStaticMarkup(createElement(ChatThread, { thread: [] }))).toBe("");
  });
});
