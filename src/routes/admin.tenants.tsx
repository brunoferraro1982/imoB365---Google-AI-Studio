import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAdminUsers, deleteAdminUser } from "@/lib/admin.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Check,
  CreditCard,
  Sparkles,
  Link as LinkIcon,
  ShieldCheck,
  Search,
  Plus,
  Phone,
  Mail,
  BadgeCheck,
  MoreHorizontal,
  Pencil,
  Ban,
  Trash2,
  UserCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Tag,
  User,
  Crown,
} from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";

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

type Plan = {
  slug: string;
  nome: string;
  limites: { imoveis?: number; usuarios?: number } | null;
};

type ProfileUser = {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  tenant_id: string | null;
  tipo_usuario: string | null;
  plano_pretendido: string | null;
  imobiliaria_nome: string | null;
  aprovado: boolean;
  pagamento_validado: boolean;
  pagamento_metodo: string | null;
  telefone: string | null;
  email: string | null;
  creci: string | null;
  provider: string | null;
  auth_created_at: string | null;
};

const STATUSES = ["trial", "active", "suspended", "cancelled"];
const statusLabel: Record<string, string> = {
  trial: "Trial",
  active: "Ativo",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};
const statusColor: Record<string, string> = {
  trial: "text-blue-600 bg-blue-500/10",
  active: "text-green-600 bg-green-500/10",
  suspended: "text-amber-600 bg-amber-500/10",
  cancelled: "text-red-600 bg-red-500/10",
};

function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    user: ProfileUser;
    tenantMode: "create" | "link";
    selectedTenantId: string;
    newTenantName: string;
    selectedRole: "admin" | "broker";
    paymentValid: boolean;
  } | null>(null);

  const [editUserModal, setEditUserModal] = useState<{
    user: ProfileUser;
    nome: string;
    telefone: string;
    tipo_usuario: string;
    plano_pretendido: string;
  } | null>(null);

  const [editTenantModal, setEditTenantModal] = useState<{
    tenant: Tenant;
    nome: string;
    cnpj: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: t }, { data: p }, adminResult] = await Promise.all([
        supabase.from("tenants").select("*").order("created_at", { ascending: false }),
        supabase.from("plans").select("slug,nome,limites").eq("ativo", true),
        listAdminUsers(),
      ]);
      setTenants((t as Tenant[]) ?? []);
      setPlans((p as Plan[]) ?? []);
      setUsers((adminResult?.users as ProfileUser[]) ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const planFor = (slug: string | null) => plans.find((p) => p.slug === slug);
  const planLabel = (slug: string | null) => planFor(slug)?.nome ?? slug ?? "—";
  const limitLabel = (n: number | undefined) => (n == null || n === -1 ? "∞" : String(n));

  const MODULE_LABELS: Record<string, string> = {
    "mod-imob": "Vendas",
    "mod-fin": "Financeiro",
    "mod-mkt": "Marketing",
    "mod-juri": "Jurídico",
    "mod-elearn": "E-Learning",
  };
  const parseModules = (raw: string | null) =>
    (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const usersOf = (tenantId: string) => users.filter((u) => u.tenant_id === tenantId);
  const orphanUsers = users.filter((u) => !u.tenant_id);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const matchesSearch = (usr: ProfileUser) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (usr.nome || "").toLowerCase().includes(s) ||
      (usr.email || "").toLowerCase().includes(s) ||
      (usr.creci || "").toLowerCase().includes(s)
    );
  };

  const tenantMatchesSearch = (t: Tenant) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      t.nome.toLowerCase().includes(s) ||
      t.slug.toLowerCase().includes(s) ||
      usersOf(t.id).some(matchesSearch)
    );
  };

  // ── Actions ──

  async function updateTenantField(id: string, field: string, value: string) {
    const { error } = await supabase.from("tenants").update({ [field]: value } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Imobiliária atualizada.");
    load();
  }

  async function deleteTenant(id: string) {
    if (!(await confirmDialog("Excluir esta imobiliária e todos os dados vinculados?"))) return;
    setLoading(true);
    const { error } = await supabase.from("tenants").delete().eq("id", id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Imobiliária excluída.");
    load();
  }

  async function saveTenantEdit() {
    if (!editTenantModal) return;
    const { error } = await supabase
      .from("tenants")
      .update({ nome: editTenantModal.nome.trim(), cnpj: editTenantModal.cnpj.trim() || null } as never)
      .eq("id", editTenantModal.tenant.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Imobiliária atualizada.");
    setEditTenantModal(null);
    load();
  }

  async function saveUserEdit() {
    if (!editUserModal) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: editUserModal.nome.trim(),
        telefone: editUserModal.telefone.trim() || null,
        tipo_usuario: editUserModal.tipo_usuario || null,
        plano_pretendido: editUserModal.plano_pretendido || null,
      } as never)
      .eq("id", editUserModal.user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Usuário atualizado.");
    setEditUserModal(null);
    load();
  }

  async function blockUser(userId: string, nome: string | null) {
    if (!(await confirmDialog(`Bloquear ${nome || "este usuário"}?`))) return;
    await supabase.from("profiles").update({ aprovado: false } as never).eq("id", userId);
    toast.success("Usuário bloqueado.");
    load();
  }

  async function deleteUser(userId: string) {
    if (!(await confirmDialog("Excluir este usuário permanentemente? (profile + auth)"))) return;
    setLoading(true);
    try {
      await deleteAdminUser({ data: { userId } });
      toast.success("Usuário excluído.");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setLoading(false);
    }
  }

  async function executeApproval() {
    if (!approvalModal) return;
    const { user, tenantMode, selectedTenantId, newTenantName, selectedRole, paymentValid } = approvalModal;
    setLoading(true);
    try {
      let finalTenantId = selectedTenantId;

      if (tenantMode === "create") {
        if (!newTenantName.trim()) { toast.error("Nome do tenant é obrigatório."); setLoading(false); return; }
        const slug = newTenantName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const planSlug = (() => {
          const norm = (x: string | null) => (x ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
          const want = norm(user.plano_pretendido);
          const found = plans.find((pl) => norm(pl.nome) === want || pl.slug === want);
          return found?.slug ?? plans.find((pl) => /free|gratis/.test(norm(pl.nome)))?.slug ?? plans[0]?.slug ?? "free";
        })();
        const { data: newT, error: tErr } = await supabase.from("tenants").insert({ nome: newTenantName.trim(), slug, status: "active", plano_slug: planSlug } as never).select().maybeSingle();
        if (tErr || !newT) throw new Error("Erro ao criar tenant: " + (tErr?.message || "Não retornado"));
        finalTenantId = (newT as Tenant).id;
      }

      if (finalTenantId) {
        await supabase.from("user_roles").delete().eq("user_id", user.id);
        await supabase.from("user_roles").insert({ user_id: user.id, tenant_id: finalTenantId, role: selectedRole } as never);
      }

      if (user.tipo_usuario === "corretor" && finalTenantId) {
        const slug = (user.nome || "corretor").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        await supabase.from("corretores").insert({ tenant_id: finalTenantId, user_id: user.id, nome: user.nome || "Corretor", email: user.email || `${slug}@exemplo.com`, slug, ativo: true, publico: true } as never);
      }

      const { error: profileErr } = await supabase.from("profiles").update({ tenant_id: finalTenantId || null, aprovado: true, pagamento_validado: paymentValid, tipo_usuario: user.tipo_usuario } as never).eq("id", user.id);
      if (profileErr) throw new Error("Erro ao atualizar perfil: " + profileErr.message);

      toast.success(`${user.nome} aprovado!`);
      setApprovalModal(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro na aprovação");
    } finally {
      setLoading(false);
    }
  }

  // ── Render helpers ──

  function UserRow({ usr, indent = false }: { usr: ProfileUser; indent?: boolean }) {
    const mappedTenant = tenants.find((t) => t.id === usr.tenant_id);
    return (
      <div className={`flex items-center gap-3 py-2.5 px-4 hover:bg-muted/30 transition group ${indent ? "pl-12" : ""}`}>
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground truncate">{usr.nome || "Sem nome"}</span>
            {usr.tipo_usuario && (
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                {usr.tipo_usuario}
              </span>
            )}
            {usr.aprovado ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-600">
                <ShieldCheck className="h-3 w-3" /> Aprovado
              </span>
            ) : (
              <span className="inline-flex items-center text-[9px] font-bold text-amber-500 animate-pulse">
                Aguardando
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground">
            {usr.email && (
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{usr.email}</span>
            )}
            {usr.telefone && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{usr.telefone}</span>
            )}
            {usr.creci && (
              <span className="flex items-center gap-1"><BadgeCheck className="h-3 w-3" />CRECI {usr.creci}</span>
            )}
          </div>
        </div>

        {/* Tags for unlinked users */}
        {!indent && !usr.tenant_id && (
          <div className="flex items-center gap-1.5 shrink-0">
            {usr.plano_pretendido && parseModules(usr.plano_pretendido).map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-violet-500/10 text-violet-600 border border-violet-500/20">
                {MODULE_LABELS[m] || m}
              </span>
            ))}
            {usr.imobiliaria_nome && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                <LinkIcon className="h-2.5 w-2.5" />{usr.imobiliaria_nome}
              </span>
            )}
            {!usr.imobiliaria_nome && usr.tipo_usuario === "corretor" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold bg-sky-500/10 text-sky-700 border border-sky-500/20">
                Individual
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!usr.aprovado && (
              <>
                <DropdownMenuItem onClick={() => setApprovalModal({
                  isOpen: true, user: usr,
                  tenantMode: usr.tipo_usuario === "imobiliaria" ? "create" : "link",
                  selectedTenantId: usr.tenant_id || "",
                  newTenantName: usr.imobiliaria_nome || "",
                  selectedRole: usr.tipo_usuario === "imobiliaria" ? "admin" : "broker",
                  paymentValid: true,
                })}>
                  <UserCheck className="h-3.5 w-3.5 mr-2" />Aprovar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setEditUserModal({
              user: usr, nome: usr.nome || "", telefone: usr.telefone || "",
              tipo_usuario: usr.tipo_usuario || "", plano_pretendido: usr.plano_pretendido || "",
            })}>
              <Pencil className="h-3.5 w-3.5 mr-2" />Editar
            </DropdownMenuItem>
            {usr.aprovado && (
              <DropdownMenuItem onClick={() => blockUser(usr.id, usr.nome)}>
                <Ban className="h-3.5 w-3.5 mr-2" />Bloquear
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => deleteUser(usr.id)} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // ── Main render ──

  const filteredTenants = tenants.filter(tenantMatchesSearch);
  const filteredOrphans = orphanUsers.filter(matchesSearch);
  const pendingCount = users.filter((u) => !u.aprovado).length;

  return (
    <div className="p-8 font-sans max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Imobiliárias & Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hierarquia de tenants, corretores vinculados e aprovações pendentes.
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filtrar por nome, e-mail, CRECI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : (
        <div className="space-y-3">
          {/* ── TENANTS (árvore) ── */}
          {filteredTenants.map((t) => {
            const members = usersOf(t.id);
            const plan = planFor(t.plano_slug);
            const maxUsers = plan?.limites?.usuarios;
            const isOpen = expanded.has(t.id);

            return (
              <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Tenant header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition select-none"
                  onClick={() => toggle(t.id)}
                >
                  <button className="shrink-0 text-muted-foreground">
                    {isOpen
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </button>

                  <Building2 className="h-5 w-5 text-primary shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-foreground">{t.nome}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${statusColor[t.status] ?? "text-muted-foreground bg-muted"}`}>
                        {statusLabel[t.status] ?? t.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span className="font-mono">{t.slug}</span>
                      {t.cnpj && <span>CNPJ: {t.cnpj}</span>}
                      <span className="flex items-center gap-0.5">
                        <CalendarDays className="h-3 w-3" />{fmtDate(t.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Plan + usage badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-primary">
                        {planLabel(t.plano_slug)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        <Users className="h-3 w-3 inline mr-0.5" />
                        {members.length}/{limitLabel(maxUsers)}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setEditTenantModal({ tenant: t, nome: t.nome, cnpj: t.cnpj ?? "" })}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Select value={t.plano_slug ?? ""} onValueChange={(v) => updateTenantField(t.id, "plano_slug", v)}>
                            <SelectTrigger className="h-6 w-full border-0 shadow-none p-0 text-xs font-normal">
                              <div className="flex items-center gap-2"><Crown className="h-3.5 w-3.5" />Alterar plano</div>
                            </SelectTrigger>
                            <SelectContent>
                              {plans.map((p) => (
                                <SelectItem key={p.slug} value={p.slug} className="text-xs">{p.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </DropdownMenuItem>
                        {t.status !== "suspended" ? (
                          <DropdownMenuItem onClick={() => updateTenantField(t.id, "status", "suspended")}>
                            <Ban className="h-3.5 w-3.5 mr-2" />Suspender
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => updateTenantField(t.id, "status", "active")}>
                            <UserCheck className="h-3.5 w-3.5 mr-2" />Reativar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteTenant(t.id)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Tenant children */}
                {isOpen && (
                  <div className="border-t border-border">
                    {members.length === 0 ? (
                      <div className="pl-12 py-3 text-[10px] text-muted-foreground italic">
                        Nenhum usuário vinculado a este tenant.
                      </div>
                    ) : (
                      members
                        .filter(matchesSearch)
                        .map((usr) => <UserRow key={usr.id} usr={usr} indent />)
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── CORRETORES INDIVIDUAIS (sem tenant) ── */}
          {filteredOrphans.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border">
                <Tag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-extrabold text-sm text-foreground">Sem vínculo</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    Cadastros pendentes ou corretores individuais ({filteredOrphans.length})
                  </span>
                </div>
              </div>
              {filteredOrphans.map((usr) => (
                <UserRow key={usr.id} usr={usr} />
              ))}
            </div>
          )}

          {filteredTenants.length === 0 && filteredOrphans.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </div>
          )}
        </div>
      )}

      {/* ════════ MODAL APROVAÇÃO ════════ */}
      {approvalModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-200 text-left text-sm">
            <h3 className="text-lg font-extrabold tracking-tight mb-1 flex items-center gap-1.5">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Aprovar {approvalModal.user.nome}
            </h3>
            <div className="text-[10px] text-muted-foreground mb-4 space-y-0.5">
              {approvalModal.user.email && <div>{approvalModal.user.email}</div>}
              {approvalModal.user.creci && <div>CRECI: {approvalModal.user.creci}</div>}
              {approvalModal.user.plano_pretendido && (
                <div>Módulos: {parseModules(approvalModal.user.plano_pretendido).map((m) => MODULE_LABELS[m] || m).join(", ")}</div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Tenant</Label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 mb-2">
                  <button type="button" onClick={() => setApprovalModal((prev) => prev ? { ...prev, tenantMode: "create" } : null)}
                    className={`py-2 text-[10px] font-bold rounded-lg border border-transparent ${approvalModal.tenantMode === "create" ? "bg-card text-primary shadow-sm border-border" : "text-muted-foreground"}`}>
                    Criar Novo
                  </button>
                  <button type="button" disabled={tenants.length === 0}
                    onClick={() => setApprovalModal((prev) => prev ? { ...prev, tenantMode: "link" } : null)}
                    className={`py-2 text-[10px] font-bold rounded-lg border border-transparent disabled:opacity-50 ${approvalModal.tenantMode === "link" ? "bg-card text-primary shadow-sm border-border" : "text-muted-foreground"}`}>
                    Vincular Existente
                  </button>
                </div>
                {approvalModal.tenantMode === "create" ? (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Nome do novo tenant:</Label>
                    <Input value={approvalModal.newTenantName}
                      onChange={(e) => setApprovalModal((prev) => prev ? { ...prev, newTenantName: e.target.value } : null)}
                      className="h-8 text-xs" placeholder="Ex: Alvorada Imóveis Ltda" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Selecione o tenant:</Label>
                    <select value={approvalModal.selectedTenantId}
                      onChange={(e) => setApprovalModal((prev) => prev ? { ...prev, selectedTenantId: e.target.value } : null)}
                      className="w-full border border-border bg-card rounded-lg p-2 h-9 text-xs">
                      <option value="">-- Selecione --</option>
                      {tenants.map((t) => {
                        const p = planFor(t.plano_slug);
                        const count = usersOf(t.id).length;
                        const max = p?.limites?.usuarios;
                        return (
                          <option value={t.id} key={t.id}>
                            {t.nome} — {planLabel(t.plano_slug)} ({count}/{limitLabel(max)})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Papel</Label>
                  <select value={approvalModal.selectedRole}
                    onChange={(e) => setApprovalModal((prev) => prev ? { ...prev, selectedRole: e.target.value as "admin" | "broker" } : null)}
                    className="w-full border border-border bg-card rounded-lg p-2 h-8 text-xs">
                    <option value="admin">Admin</option>
                    <option value="broker">Corretor</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Pagamento</Label>
                  <div className="flex items-center gap-2 mt-1.5 h-7">
                    <input type="checkbox" id="paymentValidCheck" checked={approvalModal.paymentValid}
                      onChange={(e) => setApprovalModal((prev) => prev ? { ...prev, paymentValid: e.target.checked } : null)}
                      className="h-4 w-4 text-primary bg-muted rounded border-border" />
                    <label htmlFor="paymentValidCheck" className="text-xs font-semibold text-foreground">Validado</label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => setApprovalModal(null)}>Cancelar</Button>
                <Button className="flex-1 text-xs h-9" onClick={executeApproval}>Aprovar e Liberar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL EDITAR TENANT ════════ */}
      {editTenantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-200 text-left text-sm">
            <h3 className="text-lg font-extrabold tracking-tight mb-4 flex items-center gap-1.5">
              <Pencil className="h-5 w-5 text-primary" />Editar Imobiliária
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome</Label>
                <Input value={editTenantModal.nome} onChange={(e) => setEditTenantModal((prev) => prev ? { ...prev, nome: e.target.value } : null)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CNPJ</Label>
                <Input value={editTenantModal.cnpj} onChange={(e) => setEditTenantModal((prev) => prev ? { ...prev, cnpj: e.target.value } : null)} className="h-8 text-xs" placeholder="00.000.000/0001-00" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => setEditTenantModal(null)}>Cancelar</Button>
                <Button className="flex-1 text-xs h-9" onClick={saveTenantEdit}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL EDITAR USUÁRIO ════════ */}
      {editUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-200 text-left text-sm">
            <h3 className="text-lg font-extrabold tracking-tight mb-1 flex items-center gap-1.5">
              <Pencil className="h-5 w-5 text-primary" />Editar Usuário
            </h3>
            <div className="text-[10px] text-muted-foreground mb-4">{editUserModal.user.email}</div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome</Label>
                <Input value={editUserModal.nome} onChange={(e) => setEditUserModal((prev) => prev ? { ...prev, nome: e.target.value } : null)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Telefone</Label>
                <Input value={editUserModal.telefone} onChange={(e) => setEditUserModal((prev) => prev ? { ...prev, telefone: e.target.value } : null)} className="h-8 text-xs" placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo</Label>
                <select value={editUserModal.tipo_usuario} onChange={(e) => setEditUserModal((prev) => prev ? { ...prev, tipo_usuario: e.target.value } : null)}
                  className="w-full border border-border bg-card rounded-lg p-2 h-8 text-xs">
                  <option value="">—</option>
                  <option value="corretor">Corretor</option>
                  <option value="imobiliaria">Imobiliária</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Módulos de Interesse</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {Object.entries(MODULE_LABELS).map(([slug, label]) => {
                    const mods = parseModules(editUserModal.plano_pretendido);
                    const checked = mods.includes(slug);
                    return (
                      <button key={slug} type="button"
                        onClick={() => {
                          const current = parseModules(editUserModal.plano_pretendido);
                          const next = checked ? current.filter((m) => m !== slug) : [...current, slug];
                          setEditUserModal((prev) => prev ? { ...prev, plano_pretendido: next.join(",") } : null);
                        }}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold border transition ${
                          checked ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"
                        }`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => setEditUserModal(null)}>Cancelar</Button>
                <Button className="flex-1 text-xs h-9" onClick={saveUserEdit}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}
