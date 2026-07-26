import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, Trash2, Shield, IdCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { inviteTenantMember, listTenantMembers, removeTenantMember } from "@/lib/team.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import { formatQuota } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";

export const Route = createFileRoute("/app/configuracoes/equipe")({
  component: Equipe,
});

type Member = {
  user_id: string;
  nome: string | null;
  email: string | null;
  roles: string[];
  role_ids: string[];
};

type CorretorLink = { id: string; slug: string; user_id: string | null };

const ROLES: { v: "admin" | "broker" | "juridico" | "financeiro" | "atendente"; label: string }[] =
  [
    { v: "admin", label: "Admin" },
    { v: "broker", label: "Corretor" },
    { v: "atendente", label: "Atendente" },
    { v: "juridico", label: "Jurídico" },
    { v: "financeiro", label: "Financeiro" },
  ];

function Equipe() {
  const { tenantId, user, isAdmin } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const invite = useServerFn(inviteTenantMember);
  const list = useServerFn(listTenantMembers);
  const remove = useServerFn(removeTenantMember);

  const [members, setMembers] = useState<Member[]>([]);
  const [corretores, setCorretores] = useState<CorretorLink[]>([]);
  const [quota, setQuota] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["v"]>("broker");
  const [creci, setCreci] = useState("");
  const [telefone, setTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [res, { data: corretoresData }, { data: tenant }] = await Promise.all([
        list({ data: { tenantId } }),
        supabase.from("corretores").select("id,slug,user_id").eq("tenant_id", tenantId),
        supabase.from("tenants").select("plano_slug").eq("id", tenantId).maybeSingle(),
      ]);
      setMembers((res?.members as Member[]) ?? []);
      setCorretores((corretoresData as CorretorLink[]) ?? []);
      if (tenant?.plano_slug) {
        const { data: plano } = await supabase
          .from("plans")
          .select("limites")
          .eq("slug", tenant.plano_slug)
          .maybeSingle();
        const limites = (plano?.limites as any) ?? {};
        setQuota(typeof limites.usuarios === "number" ? limites.usuarios : 0);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar equipe");
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tenantId]);

  const unlimitedUsuarios = quota === -1;
  const quotaAtingida = !unlimitedUsuarios && members.length >= quota;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    if (quotaAtingida) {
      toast.error(
        `Cota de usuários do plano atingida (${quota}). Faça upgrade para adicionar mais.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      await invite({
        data: {
          tenantId,
          email: email.trim(),
          role,
          creci: creci.trim() || undefined,
          telefone: telefone.trim() || undefined,
        },
      });
      toast.success(
        role === "broker"
          ? "Corretor adicionado — acesso ao sistema e perfil público criados"
          : "Membro adicionado",
      );
      setEmail("");
      setCreci("");
      setTelefone("");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
    setSubmitting(false);
  }

  async function handleRemove(memberId: string) {
    if (!tenantId) return;
    if (!(await confirmDialog("Remover este membro da imobiliária?"))) return;
    try {
      await remove({ data: { tenantId, userId: memberId } });
      toast.success("Membro removido");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  }

  if (!isAdmin) {
    return (
      <div className="text-sm text-muted-foreground">
        Apenas administradores podem gerenciar a equipe.
        <ConfirmDialog />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-base font-semibold">Adicionar membro</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          A pessoa precisa ter conta criada em <code>/signup</code>. Informe o e-mail dela e o papel
          — se o papel for Corretor, o perfil público (vitrine no site) já é criado junto, sem
          precisar de uma tela separada.
        </p>
        <div className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Usuários na conta</span>
            <span className="font-semibold">
              {members.length} / {formatQuota(quota)}
            </span>
          </div>
          {quotaAtingida && (
            <p className="mt-1 text-[11px] text-amber-600">
              Cota do plano atingida. Faça upgrade em{" "}
              <Link to="/app/contratacao" className="underline">
                Plano & Contratação
              </Link>{" "}
              para adicionar mais pessoas.
            </p>
          )}
        </div>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              E-mail
            </Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@empresa.com"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
              Papel
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.v} value={r.v}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={submitting || quotaAtingida}>
              <UserPlus className="mr-2 h-4 w-4" /> {submitting ? "Adicionando…" : "Adicionar"}
            </Button>
          </div>
          {role === "broker" && (
            <>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  CRECI (opcional)
                </Label>
                <Input
                  value={creci}
                  onChange={(e) => setCreci(e.target.value)}
                  placeholder="12345-F"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  Telefone (opcional)
                </Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(13) 99999-9999"
                />
              </div>
            </>
          )}
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Equipe ({members.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Sem membros vinculados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Pessoa</th>
                <th className="px-6 py-3">Papéis</th>
                <th className="px-6 py-3">Perfil de corretor</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isBroker = m.roles.includes("broker");
                const corretor = corretores.find((c) => c.user_id === m.user_id);
                return (
                  <tr key={m.user_id} className="border-t border-border">
                    <td className="px-6 py-3">
                      <div className="font-medium">{m.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <Badge
                            key={r}
                            variant={r === "super_admin" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {r === "super_admin" && <Shield className="mr-1 h-3 w-3" />}
                            {ROLE_LABEL[r] ?? r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {!isBroker ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : corretor ? (
                        <Link
                          to="/app/corretores/$id"
                          params={{ id: corretor.id }}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <IdCard className="h-3.5 w-3.5" /> Ver perfil público{" "}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <Link
                          to="/app/corretores/novo"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          <IdCard className="h-3.5 w-3.5" /> Criar perfil público
                        </Link>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {m.user_id !== user?.id && !m.roles.includes("super_admin") && (
                        <Button size="sm" variant="ghost" onClick={() => handleRemove(m.user_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
