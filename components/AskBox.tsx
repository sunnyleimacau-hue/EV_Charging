"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useApp } from "./AppContext";
import { Spinner } from "./ui";
import type { CurrentState } from "@/lib/prompts";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// Minimal, injection-safe markdown: bold (**x**), bullets and line breaks only.
function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    const bullet = line.trimStart().startsWith("- ");
    const content = bullet ? line.trimStart().slice(2) : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith("**") && seg.endsWith("**") ? (
        <strong key={j}>{seg.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{seg}</span>
      ),
    );
    return (
      <p key={i} className={bullet ? "pl-3" : ""}>
        {bullet ? "• " : ""}
        {parts}
      </p>
    );
  });
}

export default function AskBox({ context }: { context: CurrentState }) {
  const { tr, toast } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      toast("could not reach assistant", "error");
      setMessages((m) => m.slice(0, -1));
      setInput(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-8 bg-green-600 text-white"
                  : "mr-8 bg-gray-100 dark:bg-gray-800"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="space-y-1">{renderMarkdown(m.content)}</div>
              ) : (
                m.content
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-8 flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
              <Spinner className="h-4 w-4" />
            </div>
          )}
        </div>
      )}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tr("decide.askPlaceholder")}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label={tr("common.ask")}
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-600 text-white disabled:opacity-50"
        >
          {loading ? <Spinner className="h-5 w-5" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
}
