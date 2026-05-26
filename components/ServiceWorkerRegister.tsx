"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function ServiceWorkerRegister() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!installEvent || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-app items-center justify-between gap-3 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-gray-800">
      <span>add Macau EV to your home screen</span>
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            await installEvent.prompt();
            setInstallEvent(null);
          }}
          className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 font-medium"
        >
          <Download className="h-4 w-4" /> add
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="dismiss"
          className="text-gray-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
