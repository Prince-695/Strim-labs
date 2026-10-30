"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value?: string;
  text?: string;
  className?: string;
  label?: string;
}

export function CopyButton({ value, text, className, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const copyTarget = value ?? text ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyTarget);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <Button
      variant="outline"
      size={label ? "sm" : "icon"}
      onClick={handleCopy}
      className={cn("h-7 px-2 text-xs", className)}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
      {label && <span className="ml-1.5">{copied ? "Copied" : label}</span>}
    </Button>
  );
}
