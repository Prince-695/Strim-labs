import "./globals.css";
import { AppStateProvider } from "@/lib/state";

export const metadata = { title: "Strim", description: "Runtime intelligence and change platform" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
