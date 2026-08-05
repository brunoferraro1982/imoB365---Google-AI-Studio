import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radar, Plus, Trash2, Sparkles, Clock, Building2, RefreshCw, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  listarCaptacoes,
  salvarCaptacao,
  removerCaptacao,
  toggleCaptacao,
  sincronizarCaptacaoAgora,
  importarMarketplaceManual,
} from "@/lib/captacao.functions";
import { toast } from "sonner";

// Facebook Marketplace não tem API pública de leitura e proíbe expressamente
// coleta automatizada de dados (robots.txt do próprio facebook.com) — ao
// contrário da Chaves na Mão, não dá pra ter um robô igual pra lá. Em vez
// disso, o corretor navega o Marketplace no próprio login (uso humano normal,
// 100% permitido) e cola aqui o link + o texto do anúncio — o parsing abaixo
// é local (regex sobre texto que o próprio usuário colou), sem nenhuma
// requisição ao Facebook.
function parseTextoMarketplace(texto: string): {
  titulo: string;
  preco: number | null;
  descricao: string;
} {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const titulo = (linhas[0] ?? "").slice(0, 200);
  const precoMatch = texto.match(/R\$\s?([\d.,]+)/);
  let preco: number | null = null;
  if (precoMatch) {
    const num = Number(precoMatch[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isNaN(num)) preco = num;
  }
  return { titulo, preco, descricao: linhas.slice(1).join("\n") };
}

export const Route = createFileRoute("/app/leads/captacao")({
  component: CaptacaoPage,
});

// plans.slug reais (confirmado contra dev): "pro"/"business", sem prefixo "plan-".
const PLANOS_COM_ACESSO = ["pro", "business"];

type CaptacaoConfig = {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  bairro: string | null;
  tipo: string;
  finalidade: string;
  preco_min: number | null;
  preco_max: number | null;
  intervalo_horas: number;
  ativo: boolean;
  ultima_execucao: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  cobertura: "Cobertura",
  terreno: "Terreno",
  comercial: "Comercial",
};

function fmtData(d: string | null) {
  if (!d) return "Nunca rodou";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function CaptacaoPage() {
  const { tenantId } = useAuth();
  const [planoOk, setPlanoOk] = useState<boolean | null>(null);
  const [configs, setConfigs] = useState<CaptacaoConfig[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importando, setImportando] = useState(false);

  const [importForm, setImportForm] = useState({
    url: "",
    texto_colado: "",
    titulo: "",
    preco: "",
    descricao: "",
    nome_contato: "",
    telefone: "",
    cidade: "",
    bairro: "",
  });

  const [form, setForm] = useState({
    nome: "",
    cidade: "",
    uf: "",
    bairro: "",
    tipo: "apartamento",
    finalidade: "venda",
    preco_min: "",
    preco_max: "",
    intervalo_horas: 24,
  });

  const fnListar = useServerFn(listarCaptacoes);
  const fnSalvar = useServerFn(salvarCaptacao);
  const fnRemover = useServerFn(removerCaptacao);
  const fnToggle = useServerFn(toggleCaptacao);
  const fnSincronizar = useServerFn(sincronizarCaptacaoAgora);
  const fnImportar = useServerFn(importarMarketplaceManual);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data: tenant } = await supabase
      .from("tenants")
      .select("plano_slug")
      .eq("id", tenantId)
      .maybeSingle();
    const ok = PLANOS_COM_ACESSO.includes((tenant as any)?.plano_slug ?? "");
    setPlanoOk(ok);

    if (ok) {
      const result = await fnListar({ data: { tenant_id: tenantId } });
      setConfigs((result?.configs as CaptacaoConfig[]) ?? []);
      setTotalLeads(result?.totalLeads ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function onSalvar() {
    if (!tenantId) return;
    if (!form.nome || !form.cidade || !form.uf) {
      toast.error("Preencha nome, cidade e UF.");
      return;
    }
    setSalvando(true);
    try {
      await fnSalvar({
        data: {
          tenant_id: tenantId,
          nome: form.nome,
          cidade: form.cidade,
          uf: form.uf.toUpperCase(),
          bairro: form.bairro || null,
          tipo: form.tipo as any,
          finalidade: form.finalidade as any,
          preco_min: form.preco_min ? Number(form.preco_min) : null,
          preco_max: form.preco_max ? Number(form.preco_max) : null,
          intervalo_horas: form.intervalo_horas as 8 | 12 | 24 | 48,
          ativo: true,
        },
      });
      toast.success("Busca de captação criada.");
      setDialogOpen(false);
      setForm({
        nome: "",
        cidade: "",
        uf: "",
        bairro: "",
        tipo: "apartamento",
        finalidade: "venda",
        preco_min: "",
        preco_max: "",
        intervalo_horas: 24,
      });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function onSincronizarAgora() {
    if (!tenantId) return;
    setSincronizando(true);
    try {
      const resultado = await fnSincronizar({ data: { tenant_id: tenantId } });
      if (resultado.leadsNovos > 0) {
        toast.success(
          `${resultado.leadsNovos} lead(s) novo(s) capturado(s) de ${resultado.listingsEncontrados} anúncio(s) encontrado(s).`,
        );
      } else if (resultado.configsProcessadas === 0) {
        toast.info("Nenhuma busca ativa pra sincronizar.");
      } else {
        toast.info(
          `Sincronizado: ${resultado.listingsEncontrados} anúncio(s) encontrado(s), nenhum lead novo (já capturados antes ou fora do filtro).`,
        );
      }
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao sincronizar");
    } finally {
      setSincronizando(false);
    }
  }

  async function onToggle(id: string, ativo: boolean) {
    await fnToggle({ data: { id, ativo } });
    load();
  }

  async function onRemover(id: string) {
    if (!confirm("Remover esta busca de captação?")) return;
    await fnRemover({ data: { id } });
    load();
  }

  function onColarTexto(texto: string) {
    const { titulo, preco, descricao } = parseTextoMarketplace(texto);
    setImportForm((f) => ({
      ...f,
      texto_colado: texto,
      titulo: titulo || f.titulo,
      preco: preco != null ? String(preco) : f.preco,
      descricao: descricao || f.descricao,
    }));
  }

  async function onImportar() {
    if (!tenantId) return;
    if (!importForm.url || !importForm.titulo) {
      toast.error("Preencha ao menos o link e o título do anúncio.");
      return;
    }
    setImportando(true);
    try {
      const resultado = await fnImportar({
        data: {
          tenant_id: tenantId,
          url: importForm.url,
          texto_colado: importForm.texto_colado || null,
          titulo: importForm.titulo,
          preco: importForm.preco ? Number(importForm.preco) : null,
          descricao: importForm.descricao || null,
          nome_contato: importForm.nome_contato || null,
          telefone: importForm.telefone || null,
          cidade: importForm.cidade || null,
          bairro: importForm.bairro || null,
        },
      });
      if (resultado.duplicado) {
        toast.info("Esse anúncio já tinha sido importado antes — nenhum lead novo criado.");
      } else {
        toast.success("Lead criado a partir do anúncio do Marketplace.");
      }
      setImportDialogOpen(false);
      setImportForm({
        url: "",
        texto_colado: "",
        titulo: "",
        preco: "",
        descricao: "",
        nome_contato: "",
        telefone: "",
        cidade: "",
        bairro: "",
      });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar anúncio");
    } finally {
      setImportando(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!planoOk) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 text-xl font-bold">Captação Automática</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Robô que varre a Chaves na Mão em ciclos configuráveis e insere leads novos direto no
            seu funil — disponível nos planos <strong>Pro</strong> e <strong>Business</strong>.
          </p>
          <a href="/app/contratacao">
            <Button className="mt-6">Ver planos</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Radar className="h-7 w-7 text-primary" />
            Captação Automática
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalLeads} lead(s) captados até agora · leads novos entram direto no seu funil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSincronizarAgora} disabled={sincronizando}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${sincronizando ? "animate-spin" : ""}`} />
            {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 h-4 w-4" /> Nova busca
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova busca de captação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da busca</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Apartamentos Zona Leste"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={form.cidade}
                      onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                      placeholder="Santos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input
                      value={form.uf}
                      maxLength={2}
                      onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))}
                      placeholder="SP"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bairro (opcional)</Label>
                  <Input
                    value={form.bairro}
                    onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                    placeholder="Deixe em branco pra buscar a cidade toda"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={form.tipo}
                      onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_LABEL).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Finalidade</Label>
                    <Select
                      value={form.finalidade}
                      onValueChange={(v) => setForm((f) => ({ ...f, finalidade: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="venda">Venda</SelectItem>
                        <SelectItem value="aluguel">Aluguel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Preço mínimo (opcional)</Label>
                    <Input
                      type="number"
                      value={form.preco_min}
                      onChange={(e) => setForm((f) => ({ ...f, preco_min: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço máximo (opcional)</Label>
                    <Input
                      type="number"
                      value={form.preco_max}
                      onChange={(e) => setForm((f) => ({ ...f, preco_max: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ciclo de execução</Label>
                  <Select
                    value={String(form.intervalo_horas)}
                    onValueChange={(v) => setForm((f) => ({ ...f, intervalo_horas: Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">A cada 8 horas</SelectItem>
                      <SelectItem value="12">A cada 12 horas</SelectItem>
                      <SelectItem value="24">Diariamente</SelectItem>
                      <SelectItem value="48">A cada 2 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={onSalvar} disabled={salvando} className="w-full">
                  {salvando ? "Salvando..." : "Criar busca"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {configs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma busca configurada ainda. Crie a primeira pra começar a captar leads
          automaticamente.
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {TIPO_LABEL[c.tipo] ?? c.tipo} ·{" "}
                    {c.finalidade === "venda" ? "Venda" : "Aluguel"} ·{" "}
                    {c.bairro ? `${c.bairro}, ` : ""}
                    {c.cidade}/{c.uf}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />A cada {c.intervalo_horas}h · última execução:{" "}
                    {fmtData(c.ultima_execucao)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={c.ativo} onCheckedChange={(v) => onToggle(c.id, v)} />
                <Button variant="ghost" size="sm" onClick={() => onRemover(c.id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Facebook className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Importação manual (Facebook Marketplace)</h2>
              <p className="text-xs text-muted-foreground">
                O Marketplace não permite robôs — navegue lá no seu próprio login, cole o link e o
                texto do anúncio aqui pra virar lead no seu funil.
              </p>
            </div>
          </div>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-1.5 h-4 w-4" /> Importar anúncio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Importar anúncio do Marketplace</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Link do anúncio *</Label>
                  <Input
                    value={importForm.url}
                    onChange={(e) => setImportForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://www.facebook.com/marketplace/item/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colar o texto do anúncio (opcional)</Label>
                  <Textarea
                    rows={4}
                    value={importForm.texto_colado}
                    onChange={(e) => onColarTexto(e.target.value)}
                    placeholder="Selecione tudo que aparece no anúncio (título, preço, descrição) e cole aqui — os campos abaixo são preenchidos automaticamente, mas você pode editar."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={importForm.titulo}
                    onChange={(e) => setImportForm((f) => ({ ...f, titulo: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Preço (R$)</Label>
                    <Input
                      type="number"
                      value={importForm.preco}
                      onChange={(e) => setImportForm((f) => ({ ...f, preco: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Cidade / bairro</Label>
                    <div className="flex gap-2">
                      <Input
                        value={importForm.cidade}
                        onChange={(e) => setImportForm((f) => ({ ...f, cidade: e.target.value }))}
                        placeholder="Cidade"
                      />
                      <Input
                        value={importForm.bairro}
                        onChange={(e) => setImportForm((f) => ({ ...f, bairro: e.target.value }))}
                        placeholder="Bairro"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={importForm.descricao}
                    onChange={(e) => setImportForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nome do contato (se aparecer)</Label>
                    <Input
                      value={importForm.nome_contato}
                      onChange={(e) =>
                        setImportForm((f) => ({ ...f, nome_contato: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone (se aparecer)</Label>
                    <Input
                      value={importForm.telefone}
                      onChange={(e) => setImportForm((f) => ({ ...f, telefone: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={onImportar} disabled={importando} className="w-full">
                  {importando ? "Importando..." : "Criar lead a partir do anúncio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  );
}
