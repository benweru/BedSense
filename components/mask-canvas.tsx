"use client";

import { useEffect, useRef } from "react";
import { conceptById } from "@/lib/concepts";
import type { AnalyzeResult } from "@/lib/types";

export function MaskCanvas({
  src,
  alt,
  result,
}: {
  src: string;
  alt: string;
  result: AnalyzeResult | null;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;

    const draw = () => {
      const width = result?.image.width || image.naturalWidth || 1;
      const height = result?.image.height || image.naturalHeight || 1;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      if (!result) return;
      for (const mask of result.masks) {
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
  }, [result, src]);

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] bg-soil shadow-[0_18px_40px_rgba(36,48,36,0.16)]">
      {/* Phone photos are local data URLs, so the browser draws them directly. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={src} alt={alt} className="block h-auto w-full" />
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
