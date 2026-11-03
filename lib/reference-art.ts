import type { ResearchKind } from "@/lib/research";

/**
 * Static mock illustrations for demo mode: one flat leaf diagram per problem
 * kind, in the same educational style the generation prompt asks for. Never
 * mistaken for a diagnosis: the card always labels them as illustrations.
 */
const LEAF = '<ellipse cx="100" cy="82" rx="62" ry="44" fill="#4e7c3a" stroke="#2f5223" stroke-width="3"/>';

const ART: Record<ResearchKind, string> = {
  disease: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><rect width="200" height="160" fill="#f4f1e6"/>${LEAF}<line x1="48" y1="82" x2="152" y2="82" stroke="#2f5223" stroke-width="2"/><circle cx="82" cy="66" r="11" fill="#3a2c18"/><circle cx="82" cy="66" r="6" fill="#8a6b3a"/><circle cx="118" cy="96" r="9" fill="#3a2c18"/><circle cx="118" cy="96" r="5" fill="#8a6b3a"/><circle cx="104" cy="60" r="6" fill="#3a2c18"/><circle cx="104" cy="60" r="3" fill="#8a6b3a"/></svg>`,
  pest: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><rect width="200" height="160" fill="#f4f1e6"/>${LEAF}<line x1="48" y1="82" x2="152" y2="82" stroke="#2f5223" stroke-width="2"/><g fill="#241a10"><ellipse cx="80" cy="70" rx="7" ry="5"/><ellipse cx="112" cy="92" rx="7" ry="5"/><ellipse cx="100" cy="62" rx="5" ry="4"/></g><g stroke="#241a10" stroke-width="1.5"><line x1="76" y1="66" x2="72" y2="60"/><line x1="84" y1="66" x2="88" y2="60"/><line x1="108" y1="88" x2="104" y2="82"/><line x1="116" y1="88" x2="120" y2="82"/></g></svg>`,
  deficiency: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><rect width="200" height="160" fill="#f4f1e6"/>${LEAF}<path d="M100 38 A62 44 0 0 1 100 126 Z" fill="#c9a13a" opacity="0.85"/><line x1="48" y1="82" x2="152" y2="82" stroke="#2f5223" stroke-width="2"/><circle cx="120" cy="70" r="5" fill="#8a6b3a"/></svg>`,
};

export function referenceArt(kind: ResearchKind): { image: string; mime: string } {
  const svg = ART[kind];
  return { image: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`, mime: "image/svg+xml" };
}
