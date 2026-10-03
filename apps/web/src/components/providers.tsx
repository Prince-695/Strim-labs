"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          <SessionProvider>{children}</SessionProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
