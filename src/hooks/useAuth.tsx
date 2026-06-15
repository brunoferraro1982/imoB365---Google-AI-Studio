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

// FIX [super_admin]: super_admin bypassa restrição de tenant_modules e vê todos os módulos
// NOTA: apenas slugs presentes em AppModule (src/lib/permissions.ts) — "elearning" adicionado separado
const ALL_MODULES: AppModule[] = [
  "imobiliario",
  "financeiro",
  "juridico",
  "marketing",
  "ajustes",
];

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
        // FIX [super_admin]: loadRoles sequencial antes de loadProfile para passar roles.
        setTimeout(() => {
          void (async () => {
            const userRoles = await loadRoles(s.user.id);
            await loadProfile(s.user.id, s.user, userRoles);
          })();
        }, 0);
      } else {
        setRoles([]);
        setTenantId(null);
        setProfile(null);
        setEnabledModules([]);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // FIX [super_admin]: sequencial — roles primeiro, depois profile com roles.
        const userRoles = await loadRoles(s.user.id);
        await loadProfile(s.user.id, s.user, userRoles);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // FIX [super_admin]: retorna o array de roles para uso sequencial em loadProfile.
  async function loadRoles(userId: string): Promise<AppRole[]> {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const userRoles = [...new Set((data ?? []).map((r) => r.role as AppRole))];
    setRoles(userRoles);
    return userRoles;
  }

  // FIX [super_admin]: aceita userRoles para bypassar tenant_modules quando super_admin.
  async function loadProfile(userId: string, currentUser?: User, userRoles: AppRole[] = []) {
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
      // Fallback com campos básicos
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

      // FIX [super_admin]: super_admin vê TODOS os módulos — sem restrição de plano.
      if (userRoles.includes("super_admin")) {
        setEnabledModules(ALL_MODULES);
      } else if (profileData.tenant_id) {
        // Demais roles: carregar módulos habilitados do tenant
        const { data: tenantModsData } = await supabase
          .from("tenant_modules")
          .select("module_slug")
          .eq("tenant_id", profileData.tenant_id)
          .eq("enabled", true);
        const mods = (tenantModsData ?? []).map((m) => m.module_slug as AppModule);
        setEnabledModules(mods.length > 0 ? mods : ["imobiliario", "ajustes"]);
      }

      setProfile({
        nome: profileData.nome ?? null,
        avatar_url: profileData.avatar_url ?? null,
        tipo_usuario: profileData.tipo_usuario ?? currentUser?.user_metadata?.tipo_usuario ?? null,
        plano_pretendido: profileData.plano_pretendido ?? currentUser?.user_metadata?.plano_pretendido ?? null,
        imobiliaria_nome: profileData.imobiliaria_nome ?? currentUser?.user_metadata?.imobiliaria_nome ?? null,
        aprovado: profileData.aprovado === true || currentUser?.user_metadata?.aprovado === true || false,
        pagamento_validado:
          profileData.pagamento_validado === true ||
          currentUser?.user_metadata?.pagamento_validado === true ||
          false,
        pagamento_metodo: profileData.pagamento_metodo ?? currentUser?.user_metadata?.pagamento_metodo ?? null,
      });
    }
  }

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;

  return { session, user, roles, enabledModules, tenantId, profile, isSuperAdmin, isAdmin, loading };
}
