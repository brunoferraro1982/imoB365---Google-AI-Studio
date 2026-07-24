import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radar, Plus, Trash2, Sparkles, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/lib/captacao.functions";
import { toast } from "sonner";

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

  async function onToggle(id: string, ativo: boolean) {
    await fnToggle({ data: { id, ativo } });
    load();
  }

  async function onRemover(id: string) {
    if (!confirm("Remover esta busca de captação?")) return;
    await fnRemover({ data: { id } });
    load();
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
    </div>
  );
}
