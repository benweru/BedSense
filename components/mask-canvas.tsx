"use client";

import { useEffect, useRef } from "react";
import { conceptById } from "@/lib/concepts";
import type { AnalyzeResult } from "@/lib/types";

export function MaskCanvas({
  src,
  alt,
  result,
  frame = 0,
  width,
  height,
}: {
  src: string;
  alt: string;
  result: AnalyzeResult | null;
  frame?: number;
  width?: number;
  height?: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    const draw = () => {
      const drawWidth = width || result?.frames?.[frame]?.width || result?.image.width || image.naturalWidth || 1;
      const drawHeight = height || result?.frames?.[frame]?.height || result?.image.height || image.naturalHeight || 1;
      canvas.width = drawWidth;
      canvas.height = drawHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, drawWidth, drawHeight);
      if (!result) return;
      for (const mask of result.masks) {
        if ((mask.frame ?? 0) !== frame) continue;
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
    };

    if (image.complete && image.naturalWidth > 0) draw();
    image.addEventListener("load", draw);
    return () => image.removeEventListener("load", draw);
  }, [frame, height, result, src, width]);

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] bg-page shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
      {/* Phone photos are local data URLs, so the browser draws them directly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={alt} className="block h-auto w-full lg:max-h-[min(32rem,70vh)] lg:object-contain" />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full lg:object-contain"
      />
    </div>
  );
}
