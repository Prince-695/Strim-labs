import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Strim — Runtime Intelligence & Controlled Change Platform",
  description: "Know what a change will do before production finds out. Simulation, verification, and automated rollback for production infrastructure.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-brand-pink/20 selection:text-brand-pink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
