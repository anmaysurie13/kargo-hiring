"use client";

import { useState } from "react";
import { btn, Card } from "@/components/ui";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) {
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <Card className="p-6">
        <h1 className="text-lg font-semibold">Kargo hiring</h1>
        <p className="mt-1 text-sm text-slate-500">This dashboard holds data about real people. Enter the dashboard password.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className={`${btn.primary} w-full`} disabled={busy || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </Card>
    </div>
  );
}
