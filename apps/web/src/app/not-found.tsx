import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto mb-6 size-12" />
        <h1 className="text-3xl font-semibold tracking-tight">That page doesn't exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may be old, or the run it pointed to may have been deleted.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className={buttonVariants()}>
            Go to home
          </Link>
          <Link href="/runner" className={buttonVariants({ variant: "outline" })}>
            Open load runner
          </Link>
        </div>
      </div>
    </main>
  );
}
