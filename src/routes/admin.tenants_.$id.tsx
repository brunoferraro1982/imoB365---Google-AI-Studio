import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import {
  Building2,
  ChevronLeft,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { uploadTenantBrandingImage } from "@/lib/tenantBranding";
import { comprimirImagem } from "@/lib/imageCompress";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";

// Super admin edita o perfil de qualquer imobiliária / corretor autônomo:
// marca (logo/foto em tenants.tema.logo_url), dados cadastrais, atuação,
// vitrine da home — e acessa o perfil público de cada corretor do tenant.
export const Route = createFileRoute("/admin/tenants_/$id")({
  component: AdminPerfilTenant,
});

type TenantPerfil = {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  creci_juridico: string | null;
  cidades_atuacao: string[] | null;
  regiao_atuacao: string | null;
  exibir_na_home: boolean;
  tipo_tenant: string | null;
  status: string | null;
  tema: Record<string, unknown> | null;
};

type CorretorResumo = {
  id: string;
  nome: string;
  slug: string;
  foto_url: string | null;
  creci: string | null;
  creci_uf: string | null;
  ativo: boolean;
  publico: boolean;
};

function AdminPerfilTenant() {
  const { id } = Route.useParams();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [tenant, setTenant] = useState<TenantPerfil | null>(null);
  const [corretores, setCorretores] = useState<CorretorResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    creci_juridico: "",
    cidades: "",
    regiao_atuacao: "",
    exibir_na_home: false,
  });

  async function load() {
    setLoading(true);
    const [{ data: t, error }, { data: cs }] = await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id,nome,slug,cnpj,creci_juridico,cidades_atuacao,regiao_atuacao,exibir_na_home,tipo_tenant,status,tema",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("corretores")
        .select("id,nome,slug,foto_url,creci,creci_uf,ativo,publico")
        .eq("tenant_id", id)
        .order("nome"),
    ]);
    if (error || !t) {
      toast.error("Imobiliária não encontrada");
      setLoading(false);
      return;
    }
    const tp = t as unknown as TenantPerfil;
    setTenant(tp);
    setCorretores((cs as CorretorResumo[]) ?? []);
    setForm({
      nome: tp.nome ?? "",
      cnpj: tp.cnpj ?? "",
      creci_juridico: tp.creci_juridico ?? "",
      cidades: (tp.cidades_atuacao ?? []).join(", "),
      regiao_atuacao: tp.regiao_atuacao ?? "",
      exibir_na_home: !!tp.exibir_na_home,
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const logoUrl = (tenant?.tema?.logo_url as string | undefined) ?? null;

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setSaving(true);
    const cidades = form.cidades
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const { error } = await supabase
      .from("tenants")
      .update({
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || null,
        creci_juridico: form.creci_juridico.trim() || null,
        cidades_atuacao: cidades.length ? cidades : null,
        regiao_atuacao: form.regiao_atuacao.trim() || null,
        exibir_na_home: form.exibir_na_home,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Perfil da imobiliária salvo");
    load();
  }

  // Lê o tema atual antes de gravar (não sobrescrever cores/outros campos do tema)
  async function gravarLogo(url: string | undefined) {
    const { data: row } = await supabase.from("tenants").select("tema").eq("id", id).single();
    const tema = { ...((row?.tema as object) ?? {}), logo_url: url };
    const { error } = await supabase.from("tenants").update({ tema }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async function enviarLogo(e: ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original) return;
    setUploading(true);
    try {
      const file = original.type === "image/svg+xml" ? original : await comprimirImagem(original);
      const url = await uploadTenantBrandingImage(id, file);
      await gravarLogo(url);
      toast.success("Logo atualizado");
      load();
    } catch (err) {
      toast.error("Falha no upload: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removerLogo() {
    if (!(await confirmDialog("Remover o logo/foto desta imobiliária?"))) return;
    try {
      await gravarLogo(undefined);
      toast.success("Logo removido");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (loading || !tenant)
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const autonomo = tenant.tipo_tenant === "corretor";

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/tenants">
            <ChevronLeft className="mr-1 h-4 w-4" /> Imobiliárias & Usuários
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/site/${tenant.slug}`} target="_blank" rel="noreferrer">
            Ver site <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{tenant.nome}</h1>
        <Badge variant="secondary">{autonomo ? "Corretor autônomo" : "Imobiliária"}</Badge>
        {tenant.status && <Badge variant="outline">{tenant.status}</Badge>}
      </div>

      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">{autonomo ? "Foto" : "Logo"}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Aparece no site público e na vitrine da home. PNG, JPEG, SVG ou WEBP, até 2MB.
        </p>
        <div className="flex items-center gap-6">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-20 w-20 rounded-xl border border-border bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Building2 className="h-7 w-7" />
            </div>
          )}
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {uploading ? "Enviando…" : logoUrl ? "Trocar" : "Enviar"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={enviarLogo}
                disabled={uploading}
              />
            </label>
            {logoUrl && (
              <Button variant="outline" size="sm" onClick={removerLogo} aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados cadastrais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-nome">Nome *</Label>
            <Input
              id="t-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-cnpj">CNPJ</Label>
            <Input
              id="t-cnpj"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-creci">CRECI jurídico</Label>
            <Input
              id="t-creci"
              value={form.creci_juridico}
              onChange={(e) => setForm({ ...form, creci_juridico: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-cidades">Cidades de atuação</Label>
            <Input
              id="t-cidades"
              value={form.cidades}
              onChange={(e) => setForm({ ...form, cidades: e.target.value })}
              placeholder="Praia Grande, Santos, São Vicente"
            />
            <p className="text-[11px] text-muted-foreground">Separe as cidades por vírgula.</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="t-regiao">Região de atuação</Label>
            <Input
              id="t-regiao"
              value={form.regiao_atuacao}
              onChange={(e) => setForm({ ...form, regiao_atuacao: e.target.value })}
              placeholder="Litoral Sul de SP"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço do site</Label>
            <Input value={`/site/${tenant.slug}`} disabled />
            <p className="text-[11px] text-muted-foreground">
              Não editável aqui para não quebrar links já divulgados.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:mt-6 sm:self-start">
            <div>
              <Label htmlFor="t-home">Exibir na home do portal</Label>
              <p className="text-[11px] text-muted-foreground">Vitrine de parceiros</p>
            </div>
            <Switch
              id="t-home"
              checked={form.exibir_na_home}
              onCheckedChange={(v) => setForm({ ...form, exibir_na_home: v })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">Corretores ({corretores.length})</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Perfis públicos (página /corretor/…): foto, CRECI, contatos, bio e redes.
        </p>
        {corretores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum perfil de corretor neste tenant.</p>
        ) : (
          <ul className="divide-y divide-border">
            {corretores.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                {c.foto_url ? (
                  <img src={c.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.creci
                      ? `CRECI ${c.creci}${c.creci_uf ? `/${c.creci_uf}` : ""}`
                      : "Sem CRECI"}
                    {!c.ativo && " · inativo"}
                    {c.ativo && !c.publico && " · oculto no site"}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/corretores/$id" params={{ id: c.id }}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar perfil
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog />
    </div>
  );
}
