"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/state";

export default function AiPage() {
  const { token, orgId } = useAppState();
  const [q, setQ] = useState("Which endpoints are good cache candidates?");
  const [answer, setAnswer] = useState("");
  async function ask() {
    if (!token || !orgId) return;
    const res = await api<{ answer: string; citations: unknown[]; uncertainty: string }>("/v1/ai/query", {
      method: "POST",
      token,
      orgId,
      body: JSON.stringify({ question: q }),
    });
    setAnswer(`${res.answer}\n\n${res.uncertainty}`);
  }
  return (
    <div>
      <h1>AI</h1>
      <div className="row">
        <input style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => void ask()}>
          Ask
        </button>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <pre className="muted">{answer || "Grounded answers only. Never executes production changes."}</pre>
      </div>
    </div>
  );
}
