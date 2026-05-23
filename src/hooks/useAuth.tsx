import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "admin"
  | "broker"
  | "juridico"
  | "financeiro"
  | "atendente";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ nome: string | null; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid recursive call inside callback
        setTimeout(() => {
          loadRoles(s.user.id);
          loadProfile(s.user.id);
        }, 0);
      } else {
        setRoles([]);
        setTenantId(null);
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await Promise.all([
          loadRoles(s.user.id),
          loadProfile(s.user.id),
        ]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadRoles(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("tenant_id, nome, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    setTenantId(data?.tenant_id ?? null);
    setProfile(data ? { nome: data.nome ?? null, avatar_url: (data as any).avatar_url ?? null } : null);
  }

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;

  return { session, user, roles, tenantId, profile, isSuperAdmin, isAdmin, loading };
}