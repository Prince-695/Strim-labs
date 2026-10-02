"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  ShieldCheck,
  FileText,
  Database,
  GitBranch,
  Bot,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Answer = {
  answer: string;
  uncertainty: string;
  citations: { sourceType: string; sourceId: string }[];
};

const SUGGESTED_PROMPTS = [
  "Which endpoints are good cache candidates?",
  "What is the blast radius of Change Plan #01?",
  "Explain the latency spike on payment-service at 10:30",
  "Is our staging cluster ready for a 1,000 RPS spike?",
];

export default function AiPage() {
  const { token, orgId } = useSession();
  const [question, setQuestion] = useState("Which endpoints are good cache candidates?");

  const ask = useMutation({
    mutationFn: () =>
      api<Answer>("/v1/ai/query", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({ question }),
      }),
  });

  const handleSelectPrompt = (prompt: string) => {
    setQuestion(prompt);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
              Grounded AI Reliability Copilot
            </h1>
            <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-brand-pink/10 text-brand-pink border-brand-pink/30">
              Deterministic Twin
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Zero-hallucination runtime assistant grounded in your cluster traces, topology, and change plans.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full border border-border">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>Read-only sandbox guardrails active</span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Suggested SRE Inquiries:
        </span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleSelectPrompt(p)}
              className="text-xs px-3 py-1.5 rounded-xl border border-border bg-card hover:border-brand-pink/40 hover:bg-secondary text-foreground text-left cursor-pointer transition-all shadow-2xs"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interaction Card */}
      <Card className="rounded-2xl border-border/70 shadow-md overflow-hidden">
        <CardHeader className="py-3.5 px-5 bg-muted/20 border-b border-border/70">
          <CardTitle className="text-xs font-heading font-bold text-foreground flex items-center gap-2">
            <Bot className="size-4 text-brand-pink" />
            Query Copilot Engine
          </CardTitle>
          <CardDescription className="text-[11px]">
            Answers are computed exclusively from telemetry within your active organization scope.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="relative">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Ask anything regarding latency profiles, canary rollouts, or service topology..."
              className="rounded-xl text-xs font-medium resize-none pr-24"
            />
            <Button
              onClick={() => ask.mutate()}
              disabled={!question.trim() || ask.isPending}
              className="absolute right-2 bottom-2 h-8 rounded-lg bg-brand-pink hover:bg-brand-pink/90 text-white text-xs font-semibold cursor-pointer shadow-xs gap-1.5"
            >
              <Send className="size-3" />
              {ask.isPending ? "Synthesizing..." : "Ask Copilot"}
            </Button>
          </div>

          {/* Results Display */}
          {ask.data && (
            <div className="p-5 rounded-xl border border-brand-pink/30 bg-secondary/30 space-y-4 animate-in fade-in-50 duration-300">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-brand-pink text-white flex items-center justify-center">
                    <Sparkles className="size-3.5" />
                  </div>
                  <span className="text-xs font-heading font-bold text-foreground">Copilot Synthesis</span>
                </div>
                <Badge variant="outline" className="text-[10px] rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                  {ask.data.uncertainty || "100% Grounded in cluster telemetries"}
                </Badge>
              </div>

              <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                {ask.data.answer}
              </div>

              {/* Source citations */}
              {ask.data.citations && ask.data.citations.length > 0 && (
                <div className="pt-3 border-t border-border/70 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Telemetry Citations & Evidence:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ask.data.citations.map((c, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-[11px] font-mono text-muted-foreground"
                      >
                        <Database className="size-3 text-brand-pink" />
                        <span>{c.sourceType}: {c.sourceId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {ask.error && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive">
              {(ask.error as Error).message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
