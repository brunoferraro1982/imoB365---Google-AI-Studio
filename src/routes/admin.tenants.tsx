import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Check,
  X,
  UserCheck,
  UserX,
  CreditCard,
  Sparkles,
  Link as LinkIcon,
  ShieldCheck,
  Search,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/admin/tenants")({
  component: AdminTenants,
});

type Tenant = {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  plano_slug: string | null;
  status: string;
  created_at: string;
};

type ProfileUser = {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  tenant_id: string | null;
  tipo_usuario?: string | null;
  plano_pretendido?: string | null;
  imobiliaria_nome?: string | null;
  aprovado?: boolean;
  pagamento_validado?: boolean;
  pagamento_metodo?: string | null;
  email_simulated?: string | null;
};

const STATUSES = ["trial", "active", "suspended", "cancelled"];

function AdminTenants() {
  const [activeTab, setActiveTab] = useState<"tenants" | "users">("tenants");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [plans, setPlans] = useState<{ slug: string; nome: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Approval modal states
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    user: ProfileUser;
    tenantMode: "create" | "link";
    selectedTenantId: string;
    newTenantName: string;
    selectedRole: "admin" | "broker";
    paymentValid: boolean;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: t }, { data: p }, { data: u }] = await Promise.all([
        supabase.from("tenants").select("*").order("created_at", { ascending: false }),
        supabase.from("plans").select("slug,nome").eq("ativo", true),
        supabase.from("profiles").select("*"),
      ]);

      setTenants((t as Tenant[]) ?? []);
      setPlans(p ?? []);

      // Since email is not directly on public profiles, we can simulate or fetch from user metadata
      const mappedUsers = (u ?? []).map((usr: any) => ({
        ...usr,
        // fallback simulated email if not accessible, otherwise read from schema
        email_simulated:
          usr.email_simulated ||
          (usr.nome
            ? `${usr.nome.toLowerCase().replace(/\s+/g, "")}@exemplo.com`
            : "usuario@exemplo.com"),
        tipo_usuario: usr.tipo_usuario || "corretor",
        plano_pretendido: usr.plano_pretendido || "Free",
        aprovado: usr.aprovado === true || usr.aprovado === "true",
        pagamento_validado: usr.pagamento_validado === true || usr.pagamento_validado === "true",
        pagamento_metodo: usr.pagamento_metodo || "Pix",
      }));

      setUsers(mappedUsers);
    } catch (err) {
      console.error("Error loading admin data:", err);
      toast.error("Erro ao carregar dados do Supabase");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateField(id: string, field: "status" | "plano_slug", value: string) {
    const payload: Record<string, unknown> = { [field]: value };
    const { error } = await supabase
      .from("tenants")
      .update(payload as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Imobiliária atualizada com sucesso.");
    load();
  }

  // Master Approval Execution Handler
  async function executeApproval() {
    if (!approvalModal) return;
    const { user, tenantMode, selectedTenantId, newTenantName, selectedRole, paymentValid } =
      approvalModal;
    setLoading(true);

    try {
      let finalTenantId = selectedTenantId;

      // STEP 1: CREATE NEW TENANT IF CHOSEN
      if (tenantMode === "create") {
        if (!newTenantName.trim()) {
          toast.error("Nome fantasia do novo tenant é obrigatório.");
          setLoading(false);
          return;
        }

        const slug = newTenantName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const { data: newT, error: tErr } = await supabase
          .from("tenants")
          .insert({
            nome: newTenantName.trim(),
            slug,
            status: "active",
            plano_slug:
              user.plano_pretendido === "Free"
                ? "plan-free"
                : `plan-${user.plano_pretendido?.toLowerCase()}`,
          } as any)
          .select()
          .maybeSingle();

        if (tErr || !newT) {
          throw new Error("Erro ao criar o novo tenant: " + (tErr?.message || "Não retornado"));
        }
        finalTenantId = newT.id;
      }

      // STEP 2: LINK USER ROLE & AUTHENTICATION MEMBERSHIP
      if (finalTenantId) {
        // Delete any conflicting active roles first
        await supabase.from("user_roles").delete().eq("user_id", user.id);

        const { error: roleErr } = await supabase.from("user_roles").insert({
          user_id: user.id,
          tenant_id: finalTenantId,
          role: selectedRole,
        } as any);

        if (roleErr) console.warn("Role insert warning (may utilize defaults):", roleErr);
      }

      // STEP 3: ASSOCIATE LINKED BROKER RECORD (IF PROFILE TYPE IS CORRETOR)
      if (user.tipo_usuario === "corretor" && finalTenantId) {
        const slug = (user.nome || "corretor")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        // Try to insert a broker row
        const { error: brokerErr } = await supabase.from("corretores").insert({
          tenant_id: finalTenantId,
          user_id: user.id,
          nome: user.nome || "Corretor",
          email: user.email_simulated || `${slug}@exemplo.com`,
          slug,
          ativo: true,
          publico: true,
        } as any);

        if (brokerErr) console.warn("Broker record association logged/diverged:", brokerErr);
      }

      // STEP 4: UPDATE PROFILE APPROVAL ATTRIBUTES
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          tenant_id: finalTenantId || null,
          aprovado: true,
          pagamento_validado: paymentValid,
          tipo_usuario: user.tipo_usuario,
        } as any)
        .eq("id", user.id);

      if (profileErr) {
        throw new Error("Erro ao homologar cadastro em profiles: " + profileErr.message);
      }

      toast.success(`Usuário ${user.nome} homologado com sucesso!`);
      setApprovalModal(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "Erro inesperado na aprovação");
    } finally {
      setLoading(false);
    }
  }

  // Delete/Revoke user
  async function revokeUser(userId: string) {
    if (!confirm("Deseja realmente remover/negar a licença deste cadastro?")) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cadastro revogado com sucesso");
    load();
  }

  const filteredTenants = tenants.filter(
    (t) =>
      t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const filteredUsers = users.filter(
    (usr) =>
      (usr.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (usr.imobiliaria_nome || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary mb-1">
            Plataforma imob365
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Console de Aprovações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Homologação de imobiliárias, corretores individuais, pagamentos recorrentes e vínculos
            RLS.
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex bg-muted/65 p-1 rounded-xl w-fit border border-border">
          <button
            onClick={() => {
              setActiveTab("tenants");
              setSearchTerm("");
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === "tenants" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Building2 className="h-3.5 w-3.5" /> Imobiliárias ({tenants.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("users");
              setSearchTerm("");
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition ${activeTab === "users" ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="h-3.5 w-3.5" /> Fila de Aprovações (
            {users.filter((u) => !u.aprovado).length})
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filtrar por nome, slug ou imobiliária..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Processando alterações…
          </div>
        ) : activeTab === "tenants" ? (
          /* TAB 1: TENANTS LIST */
          filteredTenants.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma imobiliária cadastrada.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-xxs uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-5 py-3">Imobiliária / Tenant</th>
                  <th className="px-5 py-3">Slug Comercial</th>
                  <th className="px-5 py-3">CNPJ</th>
                  <th className="px-5 py-3">Cota Licença</th>
                  <th className="px-5 py-3">Status Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20 transition">
                    <td className="px-5 py-3.5 font-bold text-foreground text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary opacity-80" />
                      {t.nome}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted-foreground">{t.slug}</td>
                    <td className="px-5 py-3.5 font-mono">{t.cnpj ?? "Isento"}</td>
                    <td className="px-5 py-3.5">
                      <Select
                        value={t.plano_slug ?? ""}
                        onValueChange={(v) => updateField(t.id, "plano_slug", v)}
                      >
                        <SelectTrigger className="h-7 w-32 font-medium text-xxs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((p) => (
                            <SelectItem key={p.slug} value={p.slug} className="text-xxs">
                              Plano {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 py-3.5">
                      <Select
                        value={t.status}
                        onValueChange={(v) => updateField(t.id, "status", v)}
                      >
                        <SelectTrigger
                          className={`h-7 w-28 text-xxs font-bold capitalize ${t.status === "active" ? "text-green-600" : "text-amber-600"}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-xxs font-sans">
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize text-xxs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : /* TAB 2: SYSTEM USERS & APPROVALS QUEUE */
        filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum cadastro pendente ou correspondente encontrado.
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-xxs uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="px-5 py-3">Profissional</th>
                <th className="px-5 py-3">Atuação</th>
                <th className="px-5 py-3">Plano Declarado</th>
                <th className="px-5 py-3">Metodologia/Método</th>
                <th className="px-5 py-3">Vínculo Desejado</th>
                <th className="px-5 py-3">Status Liberação</th>
                <th className="px-5 py-3 text-right">Controles CRUD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((usr) => {
                const hasPlan = usr.plano_pretendido && usr.plano_pretendido !== "Free";
                const mappedTenant = tenants.find((t) => t.id === usr.tenant_id);
                return (
                  <tr
                    key={usr.id}
                    className={`hover:bg-muted/20 transition ${!usr.aprovado ? "bg-amber-500/[0.02]" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-foreground">{usr.nome || "Sem Nome"}</div>
                      <div className="text-xxs text-muted-foreground font-mono mt-0.5">
                        {usr.email_simulated}
                      </div>
                    </td>
                    <td className="px-5 py-4 capitalize font-semibold text-primary">
                      {usr.tipo_usuario}
                    </td>
                    <td className="px-5 py-4 font-bold">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xxs ${hasPlan ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {usr.plano_pretendido}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-mono">
                        <CreditCard className="h-3.5 w-3.5 opacity-60" />
                        <span>{usr.pagamento_metodo || "Isento"}</span>
                        {usr.pagamento_validado === true ? (
                          <span className="text-green-600 font-bold ml-1 text-4xs uppercase">
                            Validado
                          </span>
                        ) : (
                          hasPlan && (
                            <span className="text-amber-500 font-bold ml-1 text-4xs uppercase">
                              Pendente
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {usr.tenant_id ? (
                        <div className="font-semibold text-green-700 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {mappedTenant?.nome}
                        </div>
                      ) : usr.imobiliaria_nome ? (
                        <div
                          className="font-semibold text-amber-700 text-xxs flex items-center gap-1 max-w-[140px] truncate"
                          title={usr.imobiliaria_nome}
                        >
                          <LinkIcon className="h-3 w-3 shrink-0" />
                          {usr.imobiliaria_nome}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Pendente de Vínculo</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {usr.aprovado ? (
                        <span className="inline-flex items-center gap-1 text-green-600 font-bold text-xxs">
                          <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                          Ativo/Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-500 font-extrabold text-xxs animate-pulse">
                          Aguardando
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {!usr.aprovado ? (
                          <Button
                            size="sm"
                            className="h-7 text-3xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() =>
                              setApprovalModal({
                                isOpen: true,
                                user: usr,
                                tenantMode: usr.tipo_usuario === "imobiliaria" ? "create" : "link",
                                selectedTenantId: "",
                                newTenantName: usr.imobiliaria_nome || "",
                                selectedRole:
                                  usr.tipo_usuario === "imobiliaria" ? "admin" : "broker",
                                paymentValid: true,
                              })
                            }
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Homologar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="h-7 text-3xs font-bold text-green-600 bg-green-500/10 border-green-500/20"
                          >
                            Homologado
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeUser(usr.id)}
                          className="h-7 text-3xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          Revogar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* HOMOLOGATION MODAL */}
      {approvalModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200 text-left font-sans text-sm">
            <h3 className="text-lg font-extrabold tracking-tight mb-1 flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Homologar Cadastro de {approvalModal.user.nome}
            </h3>
            <p className="text-xxs text-muted-foreground mb-4">
              Aprovação do perfil comercial, planos de cota e isolamento de RLS.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xxs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Como tratar a imobiliária (Tenant)?
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setApprovalModal((prev) => (prev ? { ...prev, tenantMode: "create" } : null))
                    }
                    className={`py-2 text-xxs font-bold rounded-lg border border-transparent ${approvalModal.tenantMode === "create" ? "bg-card text-primary shadow-sm border-border" : "text-muted-foreground"}`}
                  >
                    Criar Novo Tenant
                  </button>
                  <button
                    type="button"
                    disabled={tenants.length === 0}
                    onClick={() =>
                      setApprovalModal((prev) => (prev ? { ...prev, tenantMode: "link" } : null))
                    }
                    className={`py-2 text-xxs font-bold rounded-lg border border-transparent disabled:opacity-50 ${approvalModal.tenantMode === "link" ? "bg-card text-primary shadow-sm border-border" : "text-muted-foreground"}`}
                  >
                    Vincular a Existente
                  </button>
                </div>

                {approvalModal.tenantMode === "create" ? (
                  <div className="space-y-1">
                    <label className="text-3xs text-muted-foreground font-semibold">
                      Nome comercial do novo Tenant corporativo:
                    </label>
                    <Input
                      value={approvalModal.newTenantName}
                      onChange={(e) =>
                        setApprovalModal((prev) =>
                          prev ? { ...prev, newTenantName: e.target.value } : null,
                        )
                      }
                      className="h-8 text-xs"
                      placeholder="Ex: Alvorada Imóveis Ltda"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-3xs text-muted-foreground font-semibold">
                      Selecione uma imobiliária parceira do sistema:
                    </label>
                    <select
                      value={approvalModal.selectedTenantId}
                      onChange={(e) =>
                        setApprovalModal((prev) =>
                          prev ? { ...prev, selectedTenantId: e.target.value } : null,
                        )
                      }
                      className="w-full border border-border bg-card rounded-lg p-2 h-9 text-xs"
                    >
                      <option value="">-- Selecione um Tenant Ativo --</option>
                      {tenants.map((t) => (
                        <option value={t.id} key={t.id}>
                          {t.nome} (plano: {t.plano_slug})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xxs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Qual é o papel (Role)?
                  </label>
                  <select
                    value={approvalModal.selectedRole}
                    onChange={(e) =>
                      setApprovalModal((prev) =>
                        prev ? { ...prev, selectedRole: e.target.value as any } : null,
                      )
                    }
                    className="w-full border border-border bg-card rounded-lg p-2 h-8.5 text-xs"
                  >
                    <option value="admin">Admin do Tenant</option>
                    <option value="broker">Corretor associado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xxs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Pagamento Validado?
                  </label>
                  <div className="flex items-center gap-2 mt-1.5 h-7">
                    <input
                      type="checkbox"
                      id="paymentValidCheck"
                      checked={approvalModal.paymentValid}
                      onChange={(e) =>
                        setApprovalModal((prev) =>
                          prev ? { ...prev, paymentValid: e.target.checked } : null,
                        )
                      }
                      className="h-4 w-4 text-primary bg-muted rounded border-border"
                    />
                    <label
                      htmlFor="paymentValidCheck"
                      className="text-xs font-semibold text-foreground"
                    >
                      Confirmar Recebimento
                    </label>
                  </div>
                </div>
              </div>

              <div className="text-3xs bg-primary/10 border border-primary/20 text-primary p-3 rounded-lg flex items-start gap-1.5 leading-normal">
                <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                Alerta de LGPD-RLS de segurança: A vinculação associará este usuário ao tenant e aos
                limites do plano {approvalModal.user.plano_pretendido} com visibilidade segregada.
              </div>

              <div className="flex gap-2 pt-2 pb-1">
                <Button
                  variant="outline"
                  className="flex-1 text-xs h-9"
                  onClick={() => setApprovalModal(null)}
                >
                  Cancelar
                </Button>
                <Button type="button" className="flex-1 text-xs h-9" onClick={executeApproval}>
                  Aprovar e Liberar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
