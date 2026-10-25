import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BedSense",
  description:
    "Phone photo of any vegetable farm bed. Onion is the primary crop. Beetroot and chili are secondary crops, each on its own bed. SAM 3.1 marks the plants. Muse Spark returns exactly three next checks: practical, non-chemical things to look at or do next. Not a diagnosis, and not a treatment rate.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3efe4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
