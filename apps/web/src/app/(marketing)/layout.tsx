import type { ReactNode } from "react";
import { FloatingNav } from "@/components/marketing/floating-nav";
import { Footer } from "@/components/marketing/footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <FloatingNav />
      <main id="main" className="flex-1 pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}
