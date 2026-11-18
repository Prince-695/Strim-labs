import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/providers/query-provider"

export const metadata: Metadata = {
  title: "Strim-Labs - API Observability & Load Testing",
  description: "Find your API's breaking point before production does.",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/logo.png", type: "image/png" }],
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark scroll-smooth">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-brand/30 selection:text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
