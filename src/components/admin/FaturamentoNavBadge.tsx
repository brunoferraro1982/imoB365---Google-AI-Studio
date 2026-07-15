import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Badge de tenants que precisam de atenção financeira no menu do super admin.
 * Conta payment_status = 'paused' (inadimplente) OU status = 'suspended'
 * (bloqueado manualmente). Atualiza em tempo real (Supabase Realtime).
 */
export function FaturamentoNavBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { count: c } = await supabase
        .from("tenants")
        .select("id", { count: "exact", head: true })
        .or("payment_status.eq.paused,status.eq.suspended");
      if (active) setCount(c ?? 0);
    };
    void load();
    const ch = supabase
      .channel(`faturamento-badge-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tenants" }, () => void load())
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
