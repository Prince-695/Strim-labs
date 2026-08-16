"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAppState, type Org } from "@/lib/state";

export default function LoginPage() {
  const [email, setEmail] = useState("priya@acme.test");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const { setToken } = useAppState();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ token: string; organizations: Org[] }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token, res.organizations);
      router.push("/runtime");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "12vh auto", padding: 24 }} className="card">
      <h1>Strim</h1>
      <p className="muted">Know what a change will do before production finds out.</p>
      <form onSubmit={onSubmit} className="row" style={{ flexDirection: "column", alignItems: "stretch", marginTop: 16 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button className="btn" type="submit">Sign in</button>
        {error ? <p className="muted">{error}</p> : null}
      </form>
    </main>
  );
}
