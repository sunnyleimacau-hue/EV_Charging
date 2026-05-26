"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-white">
            <Zap className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold">Macau EV</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            where and when to charge
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="shared password"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              wrong password
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-green-600 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
