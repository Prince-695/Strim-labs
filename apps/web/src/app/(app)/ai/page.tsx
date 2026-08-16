"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Answer = { answer: string; uncertainty: string; citations: { sourceType: string; sourceId: string }[] };

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
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">AI</h1>
      <Card>
        <CardHeader>
          <CardTitle>Grounded runtime questions</CardTitle>
          <CardDescription>Answers stay in your org scope and never execute production changes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
          <Button onClick={() => ask.mutate()} disabled={ask.isPending}>
            Ask
          </Button>
          {ask.data ? (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p>{ask.data.answer}</p>
              <p className="text-muted-foreground">{ask.data.uncertainty}</p>
            </div>
          ) : null}
          {ask.error ? <p className="text-destructive">{(ask.error as Error).message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
