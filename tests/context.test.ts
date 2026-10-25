import { describe, expect, it } from "vitest";
import {
  cleanContextAsk,
  cleanPlantName,
  contextIsEmpty,
  contextPromptBlock,
  emptyFarmerContext,
  parseFarmerContext,
} from "@/lib/context";
import { developerPrompt, userPrompt } from "@/lib/server/muse";

describe("farmer context", () => {
  it("reads structured fields and a plain note", () => {
    const structured = parseFarmerContext({
      stage: "  three weeks ",
      chemicals: "none this week",
      extra: "ignore",
    });
    expect(structured.stage).toBe("three weeks");
    expect(structured.chemicals).toBe("none this week");
    expect(structured.notes).toBe("");
    expect(parseFarmerContext("the leaves curled").notes).toBe("the leaves curled");
    expect(contextIsEmpty(emptyFarmerContext())).toBe(true);
    expect(contextIsEmpty(structured)).toBe(false);
  });

  it("puts offered context into the Muse prompt and still names any plant", () => {
    const context = parseFarmerContext({ stage: "three weeks", weather: "dry for three days" });
    const prompt = userPrompt("en", "Marks — onion 0", context, "tomato");
    expect(prompt).toContain("three weeks");
    expect(prompt).toContain("dry for three days");
    expect(prompt).toContain("tomato");
    expect(prompt).toContain("In frame: Marks — onion 0");
    expect(prompt.toLowerCase()).toContain("do not name a crop that is not in the photo");
    expect(prompt).not.toContain("grown on different beds");
    expect(prompt.toLowerCase()).toContain("active ingredient");
    expect(developerPrompt("sw")).toContain("contextAsk");
    expect(developerPrompt("en").toLowerCase()).toContain("any farm plant");
    expect(developerPrompt("en")).toContain("never on the same bed");
    expect(developerPrompt("en")).toContain("Do not mention a crop that is not in the photo");
    expect(developerPrompt("en")).toContain("plants actually in the photo");
    expect(developerPrompt("en").toLowerCase()).toContain("agroveterinary");
    expect(developerPrompt("en")).toContain("diseaseIndicated");
    expect(contextPromptBlock(emptyFarmerContext())).toContain("none");
  });

  it("drops a plant name or a follow-up ask that contains a dose", () => {
    expect(cleanPlantName("tomato")).toBe("tomato");
    expect(cleanPlantName("spray 20 ml")).toBeNull();
    expect(cleanContextAsk("")).toBeNull();
    expect(cleanContextAsk("When did you last water?")).toBe("When did you last water?");
    expect(cleanContextAsk("Use 20 ml per 20 L.")).toBeNull();
  });
});
