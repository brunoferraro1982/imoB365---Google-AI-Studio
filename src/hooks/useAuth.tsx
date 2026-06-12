import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AppModule } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "broker" | "juridico" | "financeiro" | "atendente";

export interface UserProfile {
  nome: string | null;
  avatar_url: string | null;
  tipo_usuario: string | null;
  plano_pretendido: string | null;
  imobiliaria_nome: string | null;
  aprovado: boolean;
  pagamento_validado: boolean;
  pagamento_metodo: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [enabledModules, setEnabledModules] = useState<AppModule[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // FIX [QA-04]: Usar setTimeout(0) para defer fora do callback síncrono do Supabase,
        // evitando re-entrância. As queries são disparadas assincronamente — o setLoading
        // inicial já é controlado pelo getSession().then() abaixo com Promise.all.
        setTimeout(() => {
          void Promise.all([loadRoles(s.user.id), loadProfile(s.user.id, s.user)]);
        }, 0);
      } else {
        setRoles([]);
      // Carregar módulos habilitados do tenant
      const { data: tenantModsData } = await supabase
        .from("tenant_modules")
        .select("module")
        .eq("tenant_id", profileData.tenant_id)
        .eq("enabled", true);
      const mods = (tenantModsData ?? []).map((m) => m.module as AppModule);
      setEnabledModules(mods.length > 0 ? mods : ["imobiliario", "ajustes"]);

        setTenantId(null);
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await Promise.all([loadRoles(s.user.id), loadProfile(s.user.id, s.user)]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadRoles(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles([...new Set((data ?? []).map((r) => r.role as AppRole))]);
  }

  async function loadProfile(userId: string, currentUser?: User) {
    let profileData: any = null;

    // Select approval parameters with a safe try-catch / fallback mechanism
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "tenant_id, nome, avatar_url, tipo_usuario, plano_pretendido, imobiliaria_nome, aprovado, pagamento_validado, pagamento_metodo",
      )
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      profileData = data;
    } else {
      // Fallback
      const { data: basicData } = await supabase
        .from("profiles")
        .select("tenant_id, nome, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (basicData) {
        profileData = {
          ...basicData,
          tipo_usuario: currentUser?.user_metadata?.tipo_usuario ?? null,
          plano_pretendido: currentUser?.user_metadata?.plano_pretendido ?? null,
          imobiliaria_nome: currentUser?.user_metadata?.imobiliaria_nome ?? null,
          aprovado: currentUser?.user_metadata?.aprovado === true,
          pagamento_validado: currentUser?.user_metadata?.pagamento_validado === true,
          pagamento_metodo: currentUser?.user_metadata?.pagamento_metodo ?? null,
        };
      }
    }

    if (profileData) {
      setTenantId(profileData.tenant_id ?? null);

      // Auth via role only — no hardcoded email bypass

      setProfile({
        nome: profileData.nome ?? null,
        avatar_url: profileData.avatar_url ?? null,
        tipo_usuario: (profileData.tipo_usuario ?? currentUser?.user_metadata?.tipo_usuario ?? null),
        plano_pretendido: (profileData.plano_pretendido ?? currentUser?.user_metadata?.plano_pretendido ?? null),
        imobiliaria_nome:
          profileData.imobiliaria_nome ?? currentUser?.user_metadata?.imobiliaria_nome ?? null,
        aprovado: profileData.aprovado === true || currentUser?.user_metadata?.aprovado === true || false,
        pagamento_validado: profileData.pagamento_validado === true ||
            currentUser?.user_metadata?.pagamento_validado === true ||
            false,
        pagamento_metodo:
          profileData.pagamento_metodo ?? currentUser?.user_metadata?.pagamento_metodo ?? null,
      });
    }
  }

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;

  return { session, user, roles,
    enabledModules, tenantId, profile, isSuperAdmin, isAdmin, loading };
}
