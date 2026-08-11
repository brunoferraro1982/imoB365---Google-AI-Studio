import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Factory,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Building2,
  RefreshCw,
  Link2,
  ClipboardList,
} from "lucide-react";
import { sincronizarIngestaoAgora } from "@/lib/construtoraIngestao.functions";

export const Route = createFileRoute("/admin/construtoras")({
  component: AdminConstrutorasPage,
});

// Diretório curado pelo super_admin — construtora não é tenant-scoped,
// qualquer imobiliária pode escolher qualquer construtora ativa no
// cadastro de empreendimento; "parceira" aqui é só uma curadoria de
// relacionamento (quem o super_admin atribuiu), não um gate de acesso.
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Construtora = {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  logo_url: string | null;
  descricao: string | null;
  ativo: boolean;
  exibir_no_rodape: boolean;
};

type Parceria = { id: string; tenant_id: string; tenant_nome: string; status: string };
type TenantOption = { id: string; nome: string };

type FonteIngestao = {
  id: string;
  nome: string;
  url: string;
  tipo_alvo: "empreendimento" | "imovel";
  ativo: boolean;
  intervalo_horas: number;
  ultima_execucao: string | null;
};

const FONTE_VAZIA = {
  nome: "",
  url: "",
  tipo_alvo: "empreendimento" as const,
  intervalo_horas: 24,
};

function fmtUltimaExecucao(d: string | null) {
  if (!d) return "Nunca rodou";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const CONSTRUTORA_VAZIA = {
  nome: "",
  cnpj: "",
  telefone: "",
  email: "",
  site: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_bairro: "",
  endereco_cidade: "",
  endereco_uf: "",
  endereco_cep: "",
  descricao: "",
};

function AdminConstrutorasPage() {
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [construtoras, setConstrutoras] = useState<Construtora[]>([]);
  const [parceriasCount, setParceriasCount] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<Construtora | null>(null);
  const [parcerias, setParcerias] = useState<Parceria[]>([]);
  const [buscaTenant, setBuscaTenant] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<TenantOption[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novaConstrutora, setNovaConstrutora] = useState(CONSTRUTORA_VAZIA);
  const [criando, setCriando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fontes, setFontes] = useState<FonteIngestao[]>([]);
  const [novaFonte, setNovaFonte] = useState<
    Omit<typeof FONTE_VAZIA, "tipo_alvo"> & { tipo_alvo: "empreendimento" | "imovel" }
  >(FONTE_VAZIA);
  const [criandoFonte, setCriandoFonte] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [lotesPendentes, setLotesPendentes] = useState(0);

  const fnSincronizar = useServerFn(sincronizarIngestaoAgora);

  async function load() {
    setLoading(true);
    const [{ data: lista }, { data: parceriasData }] = await Promise.all([
      supabase.from("construtoras").select("*").order("nome"),
      supabase.from("construtora_tenant_parceria").select("construtora_id"),
    ]);
    setConstrutoras((lista ?? []) as Construtora[]);
    const contagem = new Map<string, number>();
    for (const p of parceriasData ?? []) {
      contagem.set(p.construtora_id, (contagem.get(p.construtora_id) ?? 0) + 1);
    }
    setParceriasCount(contagem);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function abrirConstrutora(c: Construtora) {
    setSelecionada(c);
    setBuscaTenant("");
    setResultadosBusca([]);
    const [{ data, error }, { data: fontesData }] = await Promise.all([
      supabase
        .from("construtora_tenant_parceria")
        .select("id,tenant_id,status,tenants(nome)")
        .eq("construtora_id", c.id),
      supabase
        .from("construtora_fontes_ingestao")
        .select("*")
        .eq("construtora_id", c.id)
        .order("created_at"),
    ]);
    if (error) {
      toast.error("Erro ao carregar parcerias");
      return;
    }
    setParcerias(
      (data ?? []).map((p: any) => ({
        id: p.id,
        tenant_id: p.tenant_id,
        tenant_nome: p.tenants?.nome ?? "—",
        status: p.status,
      })),
    );
    setFontes((fontesData ?? []) as FonteIngestao[]);

    const fonteIds = (fontesData ?? []).map((f) => f.id as string);
    if (fonteIds.length > 0) {
      const { count } = await supabase
        .from("construtora_ingestao_lotes")
        .select("id", { count: "exact", head: true })
        .in("fonte_id", fonteIds)
        .eq("status", "pronto_revisao");
      setLotesPendentes(count ?? 0);
    } else {
      setLotesPendentes(0);
    }
  }

  async function criarFonte() {
    if (!selecionada) return;
    if (!novaFonte.nome.trim() || !novaFonte.url.trim()) {
      toast.error("Informe nome e URL da fonte.");
      return;
    }
    setCriandoFonte(true);
    try {
      const { error } = await supabase.from("construtora_fontes_ingestao").insert({
        construtora_id: selecionada.id,
        nome: novaFonte.nome.trim(),
        url: novaFonte.url.trim(),
        tipo_alvo: novaFonte.tipo_alvo,
        intervalo_horas: novaFonte.intervalo_horas,
      });
      if (error) throw error;
      toast.success("Fonte de ingestão cadastrada.");
      setNovaFonte(FONTE_VAZIA);
      abrirConstrutora(selecionada);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar fonte");
    } finally {
      setCriandoFonte(false);
    }
  }

  async function toggleFonte(fonte: FonteIngestao, ativo: boolean) {
    const { error } = await supabase
      .from("construtora_fontes_ingestao")
      .update({ ativo })
      .eq("id", fonte.id);
    if (error) return toast.error(error.message);
    if (selecionada) abrirConstrutora(selecionada);
  }

  async function removerFonte(fonte: FonteIngestao) {
    if (!(await confirmDialog(`Remover a fonte "${fonte.nome}"?`, { title: "Remover fonte" })))
      return;
    const { error } = await supabase
      .from("construtora_fontes_ingestao")
      .delete()
      .eq("id", fonte.id);
    if (error) return toast.error(error.message);
    toast.success("Fonte removida.");
    if (selecionada) abrirConstrutora(selecionada);
  }

  async function sincronizarAgora() {
    if (!selecionada) return;
    setSincronizando(true);
    try {
      await fnSincronizar({ data: { construtora_id: selecionada.id } });
      toast.success(
        "Sincronização iniciada em segundo plano — o ciclo completo pode levar 20+ minutos (crawl + Drive + IA). Reabra a construtora daqui a alguns minutos pra ver o progresso.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar sincronização");
    } finally {
      setSincronizando(false);
    }
  }

  async function criarConstrutora() {
    if (!novaConstrutora.nome.trim()) {
      toast.error("Informe o nome da construtora.");
      return;
    }
    setCriando(true);
    try {
      const slug = `${slugify(novaConstrutora.nome)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("construtoras").insert({
        nome: novaConstrutora.nome.trim(),
        slug,
        cnpj: novaConstrutora.cnpj.trim() || null,
        telefone: novaConstrutora.telefone.trim() || null,
        email: novaConstrutora.email.trim() || null,
        site: novaConstrutora.site.trim() || null,
        endereco_logradouro: novaConstrutora.endereco_logradouro.trim() || null,
        endereco_numero: novaConstrutora.endereco_numero.trim() || null,
        endereco_bairro: novaConstrutora.endereco_bairro.trim() || null,
        endereco_cidade: novaConstrutora.endereco_cidade.trim() || null,
        endereco_uf: novaConstrutora.endereco_uf.trim().toUpperCase() || null,
        endereco_cep: novaConstrutora.endereco_cep.trim() || null,
        descricao: novaConstrutora.descricao.trim() || null,
      });
      if (error) throw error;
      toast.success("Construtora cadastrada.");
      setNovoAberto(false);
      setNovaConstrutora(CONSTRUTORA_VAZIA);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar construtora");
    } finally {
      setCriando(false);
    }
  }

  async function patchConstrutora(patch: Partial<Construtora>) {
    if (!selecionada) return;
    const { data, error } = await supabase
      .from("construtoras")
      .update(patch)
      .eq("id", selecionada.id)
      .select("*")
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error("Sem permissão pra alterar esta construtora.");
      return;
    }
    setSelecionada(data as Construtora);
    load();
  }

  async function uploadLogo(file: File) {
    if (!selecionada) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${selecionada.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("construtora-logos")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("construtora-logos").getPublicUrl(path);
      const oldPath = selecionada.logo_url?.split("/construtora-logos/")[1];
      await patchConstrutora({ logo_url: publicUrl });
      if (oldPath) {
        await supabase.storage.from("construtora-logos").remove([oldPath]);
      }
      toast.success("Logo atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setUploading(false);
    }
  }

  async function excluirConstrutora(c: Construtora) {
    if (
      !(await confirmDialog(
        `Excluir "${c.nome}"? Empreendimentos que a referenciam ficam sem construtora vinculada (o texto livre antigo, se houver, continua visível).`,
        { title: "Excluir construtora", variant: "destructive" },
      ))
    )
      return;
    const { error } = await supabase.from("construtoras").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    setSelecionada(null);
    toast.success("Construtora excluída.");
    load();
  }

  async function buscarTenants(query: string) {
    setBuscaTenant(query);
    if (query.trim().length < 2) {
      setResultadosBusca([]);
      return;
    }
    const { data } = await supabase
      .from("tenants")
      .select("id,nome")
      .ilike("nome", `%${query.trim()}%`)
      .limit(10);
    const jaParceiras = new Set(parcerias.map((p) => p.tenant_id));
    setResultadosBusca(((data ?? []) as TenantOption[]).filter((t) => !jaParceiras.has(t.id)));
  }

  async function adicionarParceria(tenant: TenantOption) {
    if (!selecionada) return;
    const { error } = await supabase.from("construtora_tenant_parceria").insert({
      construtora_id: selecionada.id,
      tenant_id: tenant.id,
      status: "ativo",
      criado_por: "super_admin",
    });
    if (error) return toast.error(error.message);
    toast.success(`${tenant.nome} adicionada como parceira.`);
    setBuscaTenant("");
    setResultadosBusca([]);
    abrirConstrutora(selecionada);
    load();
  }

  async function removerParceria(parceria: Parceria) {
    if (!selecionada) return;
    const { error } = await supabase
      .from("construtora_tenant_parceria")
      .delete()
      .eq("id", parceria.id);
    if (error) return toast.error(error.message);
    toast.success("Parceria removida.");
    abrirConstrutora(selecionada);
    load();
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <ConfirmDialog />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Factory className="h-6 w-6" />
            Construtoras
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Diretório curado de construtoras — cadastro e atribuição de imobiliárias parceiras são
            exclusivos do super_admin.
          </p>
        </div>
        <Button size="sm" onClick={() => setNovoAberto(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nova construtora
        </Button>
      </div>

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova construtora</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">Nome *</Label>
              <Input
                value={novaConstrutora.nome}
                onChange={(e) => setNovaConstrutora((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">CNPJ</Label>
              <Input
                value={novaConstrutora.cnpj}
                onChange={(e) => setNovaConstrutora((f) => ({ ...f, cnpj: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">Telefone</Label>
              <Input
                value={novaConstrutora.telefone}
                onChange={(e) => setNovaConstrutora((f) => ({ ...f, telefone: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">E-mail</Label>
              <Input
                value={novaConstrutora.email}
                onChange={(e) => setNovaConstrutora((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">Site</Label>
              <Input
                value={novaConstrutora.site}
                onChange={(e) => setNovaConstrutora((f) => ({ ...f, site: e.target.value }))}
                placeholder="https://"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">Endereço</Label>
              <Input
                value={novaConstrutora.endereco_logradouro}
                onChange={(e) =>
                  setNovaConstrutora((f) => ({ ...f, endereco_logradouro: e.target.value }))
                }
                placeholder="Logradouro"
              />
            </div>
            <Input
              value={novaConstrutora.endereco_numero}
              onChange={(e) =>
                setNovaConstrutora((f) => ({ ...f, endereco_numero: e.target.value }))
              }
              placeholder="Número"
            />
            <Input
              value={novaConstrutora.endereco_bairro}
              onChange={(e) =>
                setNovaConstrutora((f) => ({ ...f, endereco_bairro: e.target.value }))
              }
              placeholder="Bairro"
            />
            <Input
              value={novaConstrutora.endereco_cidade}
              onChange={(e) =>
                setNovaConstrutora((f) => ({ ...f, endereco_cidade: e.target.value }))
              }
              placeholder="Cidade"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={novaConstrutora.endereco_uf}
                onChange={(e) => setNovaConstrutora((f) => ({ ...f, endereco_uf: e.target.value }))}
                placeholder="UF"
                maxLength={2}
              />
              <Input
                value={novaConstrutora.endereco_cep}
                onChange={(e) =>
                  setNovaConstrutora((f) => ({ ...f, endereco_cep: e.target.value }))
                }
                placeholder="CEP"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                Descrição
              </Label>
              <Textarea
                rows={3}
                value={novaConstrutora.descricao}
                onChange={(e) => setNovaConstrutora((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={criarConstrutora} disabled={criando}>
              {criando ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-border bg-card">
          <div className="max-h-[75vh] divide-y divide-border overflow-y-auto">
            {construtoras.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                Nenhuma construtora cadastrada ainda.
              </div>
            )}
            {construtoras.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrirConstrutora(c)}
                className={`flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-muted/50 ${
                  selecionada?.id === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt={c.nome}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <Factory className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{c.nome}</span>
                    {!c.ativo && (
                      <Badge variant="outline" className="text-[10px]">
                        Inativa
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[c.endereco_cidade, c.endereco_uf].filter(Boolean).join("/") || "—"} ·{" "}
                    {parceriasCount.get(c.id) ?? 0} parceira(s)
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          {!selecionada && (
            <div className="text-sm text-muted-foreground">
              Selecione uma construtora na lista pra editar ou gerenciar parcerias.
            </div>
          )}
          {selecionada && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {selecionada.logo_url ? (
                      <img
                        src={selecionada.logo_url}
                        alt={selecionada.nome}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <Factory className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{selecionada.nome}</div>
                    <label className="text-xs text-primary underline cursor-pointer">
                      {uploading ? "Enviando..." : "Alterar logo"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadLogo(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Ativa
                    <Switch
                      checked={selecionada.ativo}
                      onCheckedChange={(v) => patchConstrutora({ ativo: v })}
                    />
                  </label>
                  {/* A exibição na faixa de logos da home agora é gerida em
                      Admin → Vitrine de Parceiros (tabela vitrine_parceiros),
                      que mistura imobiliárias e construtoras com ordem e
                      velocidade próprias — o antigo toggle "Exibir no rodapé"
                      foi removido daqui pra não haver dois controles. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => excluirConstrutora(selecionada)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs uppercase text-muted-foreground">Nome</Label>
                  <Input
                    defaultValue={selecionada.nome}
                    onBlur={(e) =>
                      e.target.value !== selecionada.nome &&
                      patchConstrutora({ nome: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs uppercase text-muted-foreground">CNPJ</Label>
                  <Input
                    defaultValue={selecionada.cnpj ?? ""}
                    onBlur={(e) => patchConstrutora({ cnpj: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                    Telefone
                  </Label>
                  <Input
                    defaultValue={selecionada.telefone ?? ""}
                    onBlur={(e) => patchConstrutora({ telefone: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                    E-mail
                  </Label>
                  <Input
                    defaultValue={selecionada.email ?? ""}
                    onBlur={(e) => patchConstrutora({ email: e.target.value || null })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs uppercase text-muted-foreground">Site</Label>
                  <Input
                    defaultValue={selecionada.site ?? ""}
                    onBlur={(e) => patchConstrutora({ site: e.target.value || null })}
                    placeholder="https://"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                    Endereço
                  </Label>
                  <Input
                    defaultValue={selecionada.endereco_logradouro ?? ""}
                    onBlur={(e) =>
                      patchConstrutora({ endereco_logradouro: e.target.value || null })
                    }
                    placeholder="Logradouro"
                  />
                </div>
                <Input
                  defaultValue={selecionada.endereco_numero ?? ""}
                  onBlur={(e) => patchConstrutora({ endereco_numero: e.target.value || null })}
                  placeholder="Número"
                />
                <Input
                  defaultValue={selecionada.endereco_bairro ?? ""}
                  onBlur={(e) => patchConstrutora({ endereco_bairro: e.target.value || null })}
                  placeholder="Bairro"
                />
                <Input
                  defaultValue={selecionada.endereco_cidade ?? ""}
                  onBlur={(e) => patchConstrutora({ endereco_cidade: e.target.value || null })}
                  placeholder="Cidade"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    defaultValue={selecionada.endereco_uf ?? ""}
                    onBlur={(e) =>
                      patchConstrutora({
                        endereco_uf: e.target.value.toUpperCase() || null,
                      })
                    }
                    placeholder="UF"
                    maxLength={2}
                  />
                  <Input
                    defaultValue={selecionada.endereco_cep ?? ""}
                    onBlur={(e) => patchConstrutora({ endereco_cep: e.target.value || null })}
                    placeholder="CEP"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                    Descrição
                  </Label>
                  <Textarea
                    rows={3}
                    defaultValue={selecionada.descricao ?? ""}
                    onBlur={(e) => patchConstrutora({ descricao: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Building2 className="h-4 w-4" /> Imobiliárias parceiras ({parcerias.length})
                </h3>
                <div className="mb-3 space-y-1.5">
                  {parcerias.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma imobiliária parceira atribuída ainda.
                    </p>
                  )}
                  {parcerias.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-1.5 text-sm"
                    >
                      <span>{p.tenant_nome}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive"
                        onClick={() => removerParceria(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-xs"
                    placeholder="Buscar imobiliária pelo nome..."
                    value={buscaTenant}
                    onChange={(e) => buscarTenants(e.target.value)}
                  />
                </div>
                {resultadosBusca.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {resultadosBusca.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                      >
                        <span>{t.nome}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => adicionarParceria(t)}
                        >
                          <UserPlus className="mr-1 h-3 w-3" /> Adicionar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Link2 className="h-4 w-4" /> Fontes de ingestão ({fontes.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <Link to="/admin/construtoras/$id/ingestao" params={{ id: selecionada.id }}>
                      <Button size="sm" variant="outline">
                        <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                        Ver lotes
                        {lotesPendentes > 0 && (
                          <Badge className="ml-1.5 h-4 px-1 text-[10px]">{lotesPendentes}</Badge>
                        )}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={sincronizarAgora}
                      disabled={sincronizando || fontes.length === 0}
                    >
                      <RefreshCw
                        className={`mr-1.5 h-3.5 w-3.5 ${sincronizando ? "animate-spin" : ""}`}
                      />
                      {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
                    </Button>
                  </div>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Links (Linktree) de onde puxar automaticamente lançamentos/revendas desta
                  construtora — fotos, plantas e tabelas de preço viram lotes pendentes de revisão.
                </p>
                <div className="mb-3 space-y-1.5">
                  {fontes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma fonte cadastrada ainda.</p>
                  )}
                  {fontes.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{f.nome}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {f.tipo_alvo === "empreendimento" ? "Lançamento" : "Revenda"}
                          </Badge>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {f.url} · a cada {f.intervalo_horas}h ·{" "}
                          {fmtUltimaExecucao(f.ultima_execucao)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Switch checked={f.ativo} onCheckedChange={(v) => toggleFonte(f, v)} />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-destructive"
                          onClick={() => removerFonte(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-8 text-xs sm:col-span-2"
                    placeholder="Nome (ex: Lançamentos — Linktree principal)"
                    value={novaFonte.nome}
                    onChange={(e) => setNovaFonte((f) => ({ ...f, nome: e.target.value }))}
                  />
                  <Input
                    className="h-8 text-xs sm:col-span-2"
                    placeholder="https://linktr.ee/..."
                    value={novaFonte.url}
                    onChange={(e) => setNovaFonte((f) => ({ ...f, url: e.target.value }))}
                  />
                  <Select
                    value={novaFonte.tipo_alvo}
                    onValueChange={(v) =>
                      setNovaFonte((f) => ({ ...f, tipo_alvo: v as "empreendimento" | "imovel" }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empreendimento">Lançamento (empreendimento)</SelectItem>
                      <SelectItem value="imovel">Revenda (imóvel avulso)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(novaFonte.intervalo_horas)}
                    onValueChange={(v) =>
                      setNovaFonte((f) => ({ ...f, intervalo_horas: Number(v) }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">Diariamente</SelectItem>
                      <SelectItem value="48">A cada 2 dias</SelectItem>
                      <SelectItem value="168">Semanalmente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="sm:col-span-2"
                    onClick={criarFonte}
                    disabled={criandoFonte}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {criandoFonte ? "Cadastrando..." : "Adicionar fonte"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
