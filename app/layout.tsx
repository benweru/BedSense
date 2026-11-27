import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

const SITE_DESCRIPTION =
  "Your plants can’t talk, but your phone can listen - photograph any plant and get quick, practical advice";

export const metadata: Metadata = {
  metadataBase: new URL("https://bedsense.vercel.app"),
  title: {
    default: "BedSense",
    template: "%s · BedSense",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "BedSense",
    description: SITE_DESCRIPTION,
    url: "https://bedsense.vercel.app",
    siteName: "BedSense",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BedSense",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff8ec",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
