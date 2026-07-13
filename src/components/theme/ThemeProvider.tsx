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

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("imob365_theme") as Theme | null) ?? "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lidos e aplicados de forma síncrona (lazy initializer, não useEffect) para que o
  // primeiro paint já saia com o tema certo — antes disso, qualquer remount completo do
  // provider (ex.: um hard reload) renderizava um frame com "system"/claro hardcoded
  // antes do efeito corrigir, causando um flash visível para dark quando o SO estava em
  // modo escuro, mesmo com o usuário tendo o tema claro salvo.
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [resolved, setResolved] = useState<"light" | "dark">(() => applyTheme(readStoredTheme()));

  useEffect(() => {
    // fetch user pref
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase
        .from("profiles")
        .select("tema_preferido")
        .eq("id", uid)
        .maybeSingle()
        .then(({ data: p }) => {
          const t = (p?.tema_preferido as Theme) || "system";
          setThemeState(t);
          setResolved(applyTheme(t));
        });
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") setResolved(applyTheme("system"));
    };
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
