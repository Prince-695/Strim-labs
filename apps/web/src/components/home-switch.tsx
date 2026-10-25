import type { ReactNode } from "react";

/**
 * `/` is the public marketing landing page.
 * Signed-in users access their capacity console at `/dashboard`.
 */
export function HomeSwitch({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
