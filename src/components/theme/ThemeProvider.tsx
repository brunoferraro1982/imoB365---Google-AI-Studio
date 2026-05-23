import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark" | "system";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; resolved: "light" | "dark" };

const ThemeCtx = createContext<Ctx>({ theme: "system", setTheme: () => {}, resolved: "light" });

function applyTheme(t: Theme): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  // Frontend público sempre em tema claro. Dark mode apenas no app interno (/app, /admin).
  const path = window.location.pathname;
  const isInternal = path.startsWith("/app") || path.startsWith("/admin");
  if (!isInternal) {
    document.documentElement.classList.remove("dark");
    return "light";
  }
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const r = t === "system" ? sys : t;
  document.documentElement.classList.toggle("dark", r === "dark");
  return r;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const local = (typeof window !== "undefined" && localStorage.getItem("imob365_theme")) as Theme | null;
    if (local) {
      setThemeState(local);
      setResolved(applyTheme(local));
    } else {
      setResolved(applyTheme("system"));
    }
    // fetch user pref
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase.from("profiles").select("tema_preferido").eq("id", uid).maybeSingle().then(({ data: p }) => {
        const t = (p?.tema_preferido as Theme) || "system";
        setThemeState(t);
        setResolved(applyTheme(t));
      });
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (theme === "system") setResolved(applyTheme("system")); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    setResolved(applyTheme(t));
    localStorage.setItem("imob365_theme", t);
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (uid) supabase.from("profiles").update({ tema_preferido: t }).eq("id", uid);
    });
  }

  return <ThemeCtx.Provider value={{ theme, setTheme, resolved }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);