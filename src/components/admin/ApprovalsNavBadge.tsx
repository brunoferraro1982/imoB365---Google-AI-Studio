import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Badge de pendências de aprovação para o menu do super admin.
 * Conta profiles.aprovado = false e atualiza em tempo real (Supabase Realtime).
 */
export function ApprovalsNavBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { count: c } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("aprovado", false);
      if (active) setCount(c ?? 0);
    };
    void load();
    const ch = supabase
      .channel(`approvals-badge-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void load())
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (!count) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold leading-none">
      {count}
    </span>
  );
}
