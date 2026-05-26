"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Language, Session, Settings, ThemeMode } from "@/lib/types";
import { t as translate, type TranslationKey } from "@/lib/i18n";

export type TabId = "decide" | "session" | "history" | "predict";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success";
}

interface AppContextValue {
  settings: Settings | null;
  setSettings: (s: Settings) => void;
  lang: Language;
  setLang: (l: Language) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  tab: TabId;
  setTab: (t: TabId) => void;
  activeSession: Session | null;
  setActiveSession: (s: Session | null) => void;
  refreshActiveSession: () => Promise<void>;
  wifeMode: boolean;
  setWifeMode: (b: boolean) => void;
  toast: (message: string, type?: "error" | "success") => void;
  tr: (key: TranslationKey) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

const THEME_KEY = "macau-ev-theme";
const LANG_KEY = "macau-ev-lang";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function AppProvider({
  initialSettings,
  initialActiveSession,
  children,
}: {
  initialSettings: Settings | null;
  initialActiveSession: Session | null;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<Settings | null>(initialSettings);
  const [lang, setLangState] = useState<Language>("en");
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [tab, setTab] = useState<TabId>("decide");
  const [activeSession, setActiveSession] = useState<Session | null>(
    initialActiveSession,
  );
  const [wifeMode, setWifeMode] = useState<boolean>(
    initialSettings?.wife_mode_default ?? false,
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // Load persisted preferences on mount.
  useEffect(() => {
    const storedLang = localStorage.getItem(LANG_KEY) as Language | null;
    if (storedLang) setLangState(storedLang);
    const storedTheme = (localStorage.getItem(THEME_KEY) as ThemeMode) ?? "system";
    setThemeState(storedTheme);
    applyTheme(storedTheme);
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  }, []);

  const setTheme = useCallback((tm: ThemeMode) => {
    setThemeState(tm);
    localStorage.setItem(THEME_KEY, tm);
    applyTheme(tm);
  }, []);

  const refreshActiveSession = useCallback(async () => {
    const res = await fetch("/api/active-session");
    if (res.ok) {
      const data = await res.json();
      setActiveSession(data.session ?? null);
    }
  }, []);

  const toast = useCallback((message: string, type: "error" | "success" = "success") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const tr = useCallback(
    (key: TranslationKey) => translate(key, lang),
    [lang],
  );

  return (
    <AppContext.Provider
      value={{
        settings,
        setSettings,
        lang,
        setLang,
        theme,
        setTheme,
        tab,
        setTab,
        activeSession,
        setActiveSession,
        refreshActiveSession,
        wifeMode,
        setWifeMode,
        toast,
        tr,
      }}
    >
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white shadow-lg ${
              t.type === "error" ? "bg-red-600" : "bg-gray-900 dark:bg-gray-700"
            }`}
          >
            {t.type === "error" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
