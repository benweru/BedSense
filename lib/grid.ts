import type { MaskGrid } from "@/lib/types";

export function countOnes(rows: readonly string[]): number {
  let ones = 0;
  for (const row of rows) {
    for (const cell of row) {
      if (cell === "1") ones += 1;
    }
  }
  return ones;
}

export function areaFractionFromGrid(grid: MaskGrid, boxArea: number, imageArea: number): number {
  const cells = grid.width * grid.height;
  if (cells <= 0 || boxArea <= 0 || imageArea <= 0) return 0;
  return (countOnes(grid.rows) / cells) * (boxArea / imageArea);
}

export function areaFractionFromRaster(raster: Uint8Array, boxArea: number, imageArea: number): number {
  if (raster.length === 0 || boxArea <= 0 || imageArea <= 0) return 0;
  let ones = 0;
  for (const value of raster) {
    if (value) ones += 1;
  }
  return (ones / raster.length) * (boxArea / imageArea);
}

export function downsampleRaster(raster: Uint8Array, width: number, height: number, maxEdge = 36): MaskGrid {
  if (width <= 0 || height <= 0 || raster.length < width * height) {
    return { width: 1, height: 1, rows: ["1"] };
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const rows: string[] = [];
  for (let y = 0; y < th; y += 1) {
    const y0 = Math.floor((y * height) / th);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / th));
    let row = "";
    for (let x = 0; x < tw; x += 1) {
      const x0 = Math.floor((x * width) / tw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / tw));
      let on = false;
      for (let yy = y0; yy < y1 && !on; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          if (raster[yy * width + xx]) {
            on = true;
            break;
          }
        }
      }
      row += on ? "1" : "0";
    }
    rows.push(row);
  }
  return { width: tw, height: th, rows };
}

export function ellipseGrid(cols: number, rows: number): MaskGrid {
  const width = Math.max(1, cols);
  const height = Math.max(1, rows);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rx = Math.max(width / 2, 0.5);
  const ry = Math.max(height / 2, 0.5);
  const out: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      row += nx * nx + ny * ny <= 1 ? "1" : "0";
    }
    out.push(row);
  }
  return { width, height, rows: out };
}
