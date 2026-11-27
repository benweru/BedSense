import { ImageResponse } from "next/og";

export const alt = "BedSense — photo-based crop triage in English and Kiswahili";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#fff8ec",
          color: "#2b1d14",
          padding: "56px 64px",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#1f7a4d",
            }}
          >
            BedSense
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#6f5d4b",
            }}
          >
            English · Kiswahili
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#fffdf8",
            border: "1px solid rgba(43, 29, 20, 0.14)",
            borderRadius: 16,
            padding: "44px 48px",
          }}
        >
          <div
            style={{
              fontSize: 54,
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: "#2b1d14",
            }}
          >
            Your plants can’t talk, but your phone can listen
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 26,
              lineHeight: 1.4,
              color: "#6f5d4b",
            }}
          >
            Photograph any plant on your farm bed for quick, practical causes, three next checks, and Kenyan agrovet guidance.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 20,
            color: "#6f5d4b",
          }}
        >
          <span>Meta SAM segmentation · Muse Spark triage · Voice notes</span>
          <span style={{ color: "#1f7a4d", fontWeight: 600 }}>bedsense.vercel.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
