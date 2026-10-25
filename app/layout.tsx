import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BedSense",
  description:
    "Phone photo of any plant on a vegetable farm bed. Works well with onion, and often used for beetroot and chili, each on its own bed. SAM 3.1 and Muse Spark name the plant and return exactly three next checks. Not a diagnosis, and not a treatment rate.",
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
