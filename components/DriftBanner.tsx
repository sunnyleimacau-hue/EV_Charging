"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useApp } from "./AppContext";
import type { Session } from "@/lib/types";

// Quarterly tariff-drift detection: if 5+ recent completed sessions show >5%
// cost variance from their estimates, surface a banner to review settings.
export default function DriftBanner({ onReview }: { onReview: () => void }) {
  const { tr } = useApp();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sessions?limit=20");
        if (!res.ok) return;
        const sessions = (await res.json()) as Session[];
        const drifted = sessions.filter((s) => {
          if (s.actual_cost == null || s.estimated_cost <= 0) return false;
          return Math.abs(s.actual_cost - s.estimated_cost) / s.estimated_cost > 0.05;
        });
        if (drifted.length >= 5) setShow(true);
      } catch {
        // ignore
      }
    })();
  }, []);

  if (!show || dismissed) return null;

  return (
    <button
      onClick={onReview}
      className="flex w-full items-center gap-2 bg-amber-50 px-4 py-2 text-left text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{tr("drift.banner")}</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="text-amber-600"
      >
        <X className="h-4 w-4" />
      </span>
    </button>
  );
}
