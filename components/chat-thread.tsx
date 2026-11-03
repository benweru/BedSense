import type { AskTurn } from "@/lib/types";

/** The Q&A thread: farmer questions, BedSense answers, and system turns tracing agent decisions. */
export function ChatThread({ thread }: { thread: readonly AskTurn[] }) {
  if (thread.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {thread.map((turn, index) => (
        <li
          key={`${index}-${turn.text.slice(0, 24)}`}
          className={
            turn.role === "farmer"
              ? "rounded-lg border border-leaf/40 bg-leaf/10 px-4 py-3 text-base leading-6 text-paper"
              : turn.role === "system"
                ? "rounded-lg border border-dashed border-sun/60 bg-sun/10 px-4 py-3 text-base leading-6 text-paper"
                : "rounded-lg border border-ink/10 bg-field px-4 py-3 text-base leading-6 text-paper"
          }
        >
          {turn.text}
        </li>
      ))}
    </ul>
  );
}
