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
        // FIX [QA-04]: setTimeout(0) para defer fora do callback síncrono do Supabase.
        // O setLoading(false) é controlado pelo getSession().then() com Promise.all abaixo.
        setTimeout(() => {
          void Promise.all([loadRoles(s.user.id), loadProfile(s.user.id, s.user)]);
        }, 0);
      } else {
        setRoles([]);
        setEnabledModules([]);
        setTenantId(null);
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // FIX [QA-04]: Aguarda roles E profile antes de liberar loading.
        // Evita race condition onde setLoading(false) ocorria antes de loadRoles()
        // e ejetava super_admin para /app por roles=[].
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
      // Fallback para perfis sem todas as colunas
      const { data: basicData } = await supabase
        .from("profiles")
        .select("tenant_id, nome, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (basicData) {
        profileData = {
          ...basicData,
          // INFO: user_metadata usado como fallback informativo (não como gate de acesso)
          // INFO: user_metadata usado como fallback informativo (não como gate de acesso)
          tipo_usuario: currentUser?.user_metadata?.tipo_usuario ?? null,
          plano_pretendido: currentUser?.user_metadata?.plano_pretendido ?? null,
          imobiliaria_nome: currentUser?.user_metadata?.imobiliaria_nome ?? null,
          aprovado: false,
          pagamento_validado: false, // SEGURANÇA: user_metadata é gravável pelo usuário — nunca como gate de auth
          pagamento_metodo: currentUser?.user_metadata?.pagamento_metodo ?? null,
        };
      }
    }

    if (profileData) {
      setTenantId(profileData.tenant_id ?? null);

      setProfile({
        nome: profileData.nome ?? null,
        avatar_url: profileData.avatar_url ?? null,
        tipo_usuario: profileData.tipo_usuario ?? currentUser?.user_metadata?.tipo_usuario ?? null,
        plano_pretendido:
          profileData.plano_pretendido ?? currentUser?.user_metadata?.plano_pretendido ?? null,
        imobiliaria_nome:
          profileData.imobiliaria_nome ?? currentUser?.user_metadata?.imobiliaria_nome ?? null,
        aprovado:
          profileData.aprovado === true,
        pagamento_validado:
          profileData.pagamento_validado === true, // SEGURANÇA: removido fallback user_metadata (Sprint 1 — OWASP A01)
        pagamento_metodo:
          profileData.pagamento_metodo ?? currentUser?.user_metadata?.pagamento_metodo ?? null,
      });

      // FIX [QA-04 / tenant_modules]: Carregar módulos habilitados aqui, dentro de
      // loadProfile(), onde tenant_id está disponível. O código estava incorretamente
      // no bloco else{} do onAuthStateChange (escopo errado — profileData não existia
      // lá e o await estava dentro de callback não-async).
      if (profileData.tenant_id) {
        const { data: tenantModsData } = await supabase
          .from("tenant_modules")
          .select("module_slug")
          .eq("tenant_id", profileData.tenant_id)
          .eq("enabled", true);
        const mods = (tenantModsData ?? []).map((m) => m.module_slug as AppModule);
        setEnabledModules(mods.length > 0 ? mods : ["imobiliario", "ajustes"]);
      } else {
        // super_admin sem tenant ou perfil incompleto — habilita tudo
        setEnabledModules(["imobiliario", "ajustes"]);
      }
    }
  }

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;

  return { session, user, roles, enabledModules, tenantId, profile, isSuperAdmin, isAdmin, loading };
}
