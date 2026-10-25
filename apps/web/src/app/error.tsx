"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">This page hit an error</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing was lost on the server. Reload the section to try again{error.digest ? ` (reference ${error.digest})` : ""}.
        </p>
        <Button className="mt-6" onClick={reset}>
          Reload this section
        </Button>
      </div>
    </main>
  );
}
