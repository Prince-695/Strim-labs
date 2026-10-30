import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono, Figtree } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/components/theme-provider";
import "./globals.css";
import { cn } from "@/lib/utils";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "STRIM Labs — Find your API's breaking point before production does",
    template: "%s · STRIM Labs",
  },
  description:
    "Run real HTTP load tests, see where latency degrades, and compare performance between builds. Live telemetry, saturation knee detection and a CI regression gate.",
  applicationName: "STRIM Labs",
  openGraph: {
    title: "STRIM Labs",
    description: "Find your API's breaking point before production does.",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  twitter: { card: "summary_large_image", title: "STRIM Labs", description: "Find your API's breaking point before production does." },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1015" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(ibmPlexMono.variable, "font-sans", figtree.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only z-[200] rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
