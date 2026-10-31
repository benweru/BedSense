"use client";

import { useEffect, useRef } from "react";
import { conceptById } from "@/lib/concepts";
import type { AnalyzeResult, ConceptId, MaskMark } from "@/lib/types";

/** Plant and crop marks wipe in first; weeds and symptoms follow. */
const LATE_LAYER: readonly ConceptId[] = ["weed", "yellow-leaf"];

export function MaskCanvas({
  src,
  alt,
  result,
  frame = 0,
  width,
  height,
  showMasks = true,
  scanning = false,
}: {
  src: string;
  alt: string;
  result: AnalyzeResult | null;
  frame?: number;
  width?: number;
  height?: number;
  showMasks?: boolean;
  scanning?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const plantRef = useRef<HTMLCanvasElement>(null);
  const weedRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = imgRef.current;
    const plantCanvas = plantRef.current;
    const weedCanvas = weedRef.current;
    if (!image || !plantCanvas || !weedCanvas) return;

    const draw = () => {
      const drawWidth = width || result?.frames?.[frame]?.width || result?.image.width || image.naturalWidth || 1;
      const drawHeight = height || result?.frames?.[frame]?.height || result?.image.height || image.naturalHeight || 1;
      for (const canvas of [plantCanvas, weedCanvas]) {
        canvas.width = drawWidth;
        canvas.height = drawHeight;
        canvas.getContext("2d")?.clearRect(0, 0, drawWidth, drawHeight);
      }
      if (!result) return;
      const plantContext = plantCanvas.getContext("2d");
      const weedContext = weedCanvas.getContext("2d");
      if (!plantContext || !weedContext) return;
      for (const mask of result.masks) {
        if ((mask.frame ?? 0) !== frame) continue;
        paint(LATE_LAYER.includes(mask.conceptId) ? weedContext : plantContext, mask);
      }
    };

    if (image.complete && image.naturalWidth > 0) draw();
    image.addEventListener("load", draw);
    return () => image.removeEventListener("load", draw);
  }, [frame, height, result, src, width]);

  const revealKey = `${result?.id ?? "none"}-${frame}`;

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-page shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
      {/* Phone photos are local data URLs, so the browser draws them directly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={alt} className="block h-auto w-full lg:max-h-[min(34rem,72vh)] lg:object-contain" />
      <canvas
        key={`p-${revealKey}`}
        ref={plantRef}
        aria-hidden="true"
        className={`mask-layer pointer-events-none absolute inset-0 h-full w-full lg:object-contain ${result ? "mask-wipe" : ""}`}
        style={{ opacity: showMasks ? 1 : 0 }}
      />
      <canvas
        key={`w-${revealKey}`}
        ref={weedRef}
        aria-hidden="true"
        className={`mask-layer pointer-events-none absolute inset-0 h-full w-full lg:object-contain ${result ? "mask-wipe" : ""}`}
        style={{ opacity: showMasks ? 1 : 0, animationDelay: "260ms" }}
      />
      {scanning ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,12,0.15),rgba(7,17,12,0.45))]" />
          <div className="scan-line" />
        </div>
      ) : null}
    </div>
  );
}

function paint(context: CanvasRenderingContext2D, mask: MaskMark) {
  context.fillStyle = conceptById(mask.conceptId).color;
  const cellW = mask.box.width / Math.max(1, mask.grid.width);
  const cellH = mask.box.height / Math.max(1, mask.grid.height);
  mask.grid.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== "1") continue;
      context.fillRect(mask.box.x + x * cellW, mask.box.y + y * cellH, cellW + 0.4, cellH + 0.4);
    }
  });
}
