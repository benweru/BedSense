# Copilot instructions for BedSense

Also follow `AGENTS.md`.

## BedSense UI rules

- Palette: page #fff8ec, card #fffdf8, field #f7ecd9, ink #2b1d14, mute #6f5d4b, leaf #1f7a4d. Green is the only accent colour.
- Text must reach WCAG AA: 4.5:1 for body text, 3:1 for large text. Never use `text-sun` (#ffc21a) for text. It reaches only about 1.4:1. For warning text, use ink with a short word label like "Check" or "Angalia", or use `#8a5a00`, which reaches about 5:1.
- `sun` may only fill large shapes (a bg tint or an illustration). Never use it for text, borders or hover states.
- No coloured side borders (`border-l-*` accents) on cards or quotes. Separate sections with a heading, or with a neutral 1px `border-ink/10` hairline all around the card.
- Show severity in words in the heading, e.g. "Act now" or "Chukua hatua sasa". Do not show it as colour alone. Use no pills, dots, badges, glows, sparkles, gradients or emoji icons.
- No glow shadows (`shadow-[0_0_...]`). Use at most one subtle elevation.
- Round corners consistently: `rounded-lg` for cards and `rounded-full` only for primary buttons.
- Before adding a style, reuse the existing tokens and components in `components/premium.tsx` and `app/globals.css`. Do not add new colours.
- Every visible string needs natural Swahili in `lib/copy.ts`. Check that layouts survive longer Swahili text.
- Keep the diff minimal. Do not add decorative wrappers, extra cards or icons that carry no information.

### Design skills (vendored in `.github/skills/`)
Read these before UI work. If a skill disagrees with the BedSense rules above, the BedSense rules win.
- `.github/skills/frontend-design/SKILL.md`: Anthropic frontend-design. Choose a deliberate direction and avoid generic AI aesthetics.
- `.github/skills/impeccable/SKILL.md` with `reference/*.md`: Impeccable design commands. Use `quieter`, `distill`, `polish`, `audit` and `critique` for decluttering.
- `.github/skills/web-interface-guidelines/SKILL.md`: Vercel Web Interface Guidelines, covering accessibility, focus, forms and motion.
