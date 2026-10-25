import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BedSense",
  description:
    "Phone photo of a Kenya farm bed. SAM 3.1 marks onion, beetroot, and chili. Muse Spark suggests three triage checks — not a diagnosis, and never a spray dose.",
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
