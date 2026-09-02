import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FINALIDADE_LABEL, STATUS_LABEL, TIPO_LABEL, slugify } from "@/lib/format";
import { CheckCircle2, FileText, Globe, Droplets, Ban, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { aplicarMarcaDagua } from "@/lib/watermark";
import { AiImovelPanel } from "./AiImovelPanel";

export type ImovelFormSectionKey =
  | "principal"
  | "valores"
  | "endereco"
  | "condicoes"
  | "corretor"
  | "marca_dagua"
  | "campos_personalizados"
  | "situacao";

export type ImovelFormData = {
  titulo: string;
  slug: string;
  codigo_interno: string;
  descricao: string;
  finalidade: string;
  tipo: string;
  status: string;
  preco: number;
  condominio: number | null;
  iptu: number | null;
  area_total: number | null;
  area_util: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  mostrar_endereco_publico: boolean;
  aceita_financiamento: boolean;
  aceita_permuta: boolean;
  publicado: boolean;
  corretor_responsavel_id: string | null;
  marca_dagua_ativa: boolean;
  custom_data: Record<string, any>;
};

export const emptyImovel: ImovelFormData = {
  titulo: "",
  slug: "",
  codigo_interno: "",
  descricao: "",
  finalidade: "venda",
  tipo: "apartamento",
  status: "rascunho",
  preco: 0,
  condominio: null,
  iptu: null,
  area_total: null,
  area_util: null,
  quartos: null,
  suites: null,
  banheiros: null,
  vagas: null,
  endereco_cep: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_complemento: "",
  endereco_bairro: "",
  endereco_cidade: "",
  endereco_uf: "",
  mostrar_endereco_publico: false,
  aceita_financiamento: false,
  aceita_permuta: false,
  publicado: false,
  corretor_responsavel_id: null,
  marca_dagua_ativa: false,
  custom_data: {},
};

export function ImovelForm({
  initial,
  onSubmit,
  submitLabel,
  submitting,
  mode = "create",
  activeSection = "all",
  onDataChange,
  onCustomFieldsCountChange,
}: {
  initial?: Partial<ImovelFormData>;
  onSubmit: (
    data: ImovelFormData,
    action: "save" | "publish" | "unpublish",
  ) => Promise<void> | void;
  submitLabel: string;
  submitting?: boolean;
  mode?: "create" | "edit";
  /** Quando informado, renderiza só a seção pedida (uso pelo wizard); default "all" preserva a página clássica com todas as seções + rodapé. */
  activeSection?: ImovelFormSectionKey | "all";
  /** Disparado a cada mudança de campo — usado pelo wizard só pra ler `finalidade` sem precisar levantar o estado inteiro do form. */
  onDataChange?: (data: ImovelFormData) => void;
  /** Disparado uma vez, ao carregar os campos personalizados do tenant — usado pelo wizard pra decidir se inclui o passo "Campos personalizados" na navegação. */
  onCustomFieldsCountChange?: (count: number) => void;
}) {
  const { tenantId } = useAuth();
  const [data, setData] = useState<ImovelFormData>({ ...emptyImovel, ...initial });
  const [pendingAction, setPendingAction] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [corretores, setCorretores] = useState<{ id: string; nome: string }[]>([]);
  const [corretorOpen, setCorretorOpen] = useState(false);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data: list } = await (supabase as any)
        .from("corretores")
        .select("id,nome")
        .eq("ativo", true)
        .eq("tenant_id", tenantId)
        .order("nome");
      setCorretores((list as { id: string; nome: string }[]) ?? []);
      const { data: cf } = await (supabase as any)
        .from("tenant_custom_fields")
        .select("*")
        .eq("entidade", "imovel")
        .order("ordem")
        .order("created_at");
      setCustomFields(cf ?? []);
      onCustomFieldsCountChange?.((cf ?? []).length);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("tenants")
      .select("tema")
      .eq("id", tenantId)
      .maybeSingle()
      .then(({ data: t }) => {
        const logo = (t?.tema as { logo_url?: string } | null)?.logo_url ?? null;
        setTenantLogoUrl(logo || null);
      });
  }, [tenantId]);

  function update<K extends keyof ImovelFormData>(k: K, v: ImovelFormData[K]) {
    setData((d) => {
      const next = { ...d, [k]: v };
      onDataChange?.(next);
      return next;
    });
  }

  function showSection(key: ImovelFormSectionKey) {
    return activeSection === "all" || activeSection === key;
  }

  async function lookupCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const json = await res.json();
      if (json.erro) return;
      setData((d) => ({
        ...d,
        endereco_logradouro: json.logradouro ?? d.endereco_logradouro,
        endereco_bairro: json.bairro ?? d.endereco_bairro,
        endereco_cidade: json.localidade ?? d.endereco_cidade,
        endereco_uf: json.uf ?? d.endereco_uf,
      }));
    } catch {
      /* silent */
    }
  }

  function submitWith(action: "save" | "publish" | "unpublish", e?: FormEvent) {
    e?.preventDefault();
    let payload: ImovelFormData = { ...data, slug: data.slug || slugify(data.titulo) };
    if (action === "publish") {
      payload = { ...payload, publicado: true, status: "ativo" };
      setData(payload);
    } else if (action === "unpublish") {
      payload = {
        ...payload,
        publicado: false,
        status: payload.status === "ativo" ? "inativo" : payload.status,
      };
      setData(payload);
    }
    setPendingAction(action);
    onSubmit(payload, action);
  }

  const isPublished = data.publicado && data.status === "ativo";
  // 3 estados distintos (não só publicado/rascunho binário) — status comercial
  // (vendido/alugado/reservado/inativo) é uma decisão de negócio já tomada, não
  // uma pendência de preenchimento, então não deve usar a mensagem de "rascunho".
  const statusInfo: { tone: "published" | "draft" | "business"; title: string; desc: string } =
    isPublished
      ? {
          tone: "published",
          title: "Publicado no site público",
          desc: "Visível para visitantes em /buscar e na página do imóvel.",
        }
      : data.status === "rascunho"
        ? {
            tone: "draft",
            title: "Rascunho — publique para aparecer no site",
            desc: "Conclua o preenchimento e clique em Publicar para tornar visível.",
          }
        : {
            tone: "business",
            title: `Marcado como ${STATUS_LABEL[data.status] ?? data.status}`,
            desc: "Não aparece na busca pública — é um estado comercial já definido, não uma pendência de publicação.",
          };

  return (
    <form
      onSubmit={(e) => submitWith(mode === "create" ? "save" : "save", e)}
      className="space-y-8"
    >
      {showSection("principal") && (
        <Section title="Informações principais">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Título *">
              <Input
                required
                value={data.titulo}
                onChange={(e) => update("titulo", e.target.value)}
              />
            </Field>
            <Field label="Código interno">
              <Input
                value={data.codigo_interno}
                onChange={(e) => update("codigo_interno", e.target.value)}
              />
            </Field>
            <Field label="Finalidade">
              <Select value={data.finalidade} onValueChange={(v) => update("finalidade", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FINALIDADE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={data.tipo} onValueChange={(v) => update("tipo", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea
              rows={5}
              value={data.descricao}
              onChange={(e) => update("descricao", e.target.value)}
            />
          </Field>
          <AiImovelPanel
            data={data}
            onApplyDescricao={(t) => update("descricao", t)}
            onApplyTitulo={(t) => update("titulo", t)}
          />
        </Section>
      )}

      {showSection("valores") && (
        <Section title="Valores e medidas">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Preço (R$) *">
              <NumberInput required value={data.preco} onChange={(v) => update("preco", v ?? 0)} />
            </Field>
            <Field label="Condomínio (R$)">
              <NumberInput value={data.condominio} onChange={(v) => update("condominio", v)} />
            </Field>
            <Field label="IPTU (R$)">
              <NumberInput value={data.iptu} onChange={(v) => update("iptu", v)} />
            </Field>
            <Field label="Área total (m²)">
              <NumberInput value={data.area_total} onChange={(v) => update("area_total", v)} />
            </Field>
            <Field label="Área útil (m²)">
              <NumberInput value={data.area_util} onChange={(v) => update("area_util", v)} />
            </Field>
            <Field label="Quartos">
              <NumberInput value={data.quartos} onChange={(v) => update("quartos", v)} />
            </Field>
            <Field label="Suítes">
              <NumberInput value={data.suites} onChange={(v) => update("suites", v)} />
            </Field>
            <Field label="Banheiros">
              <NumberInput value={data.banheiros} onChange={(v) => update("banheiros", v)} />
            </Field>
            <Field label="Vagas">
              <NumberInput value={data.vagas} onChange={(v) => update("vagas", v)} />
            </Field>
          </div>
        </Section>
      )}

      {showSection("endereco") && (
        <Section title="Endereço">
          <div className="grid gap-4 md:grid-cols-6">
            <Field label="CEP" className="md:col-span-2">
              <Input
                value={data.endereco_cep}
                onChange={(e) => update("endereco_cep", e.target.value)}
                onBlur={(e) => lookupCep(e.target.value)}
                placeholder="00000-000"
              />
            </Field>
            <Field label="Logradouro" className="md:col-span-4">
              <Input
                value={data.endereco_logradouro}
                onChange={(e) => update("endereco_logradouro", e.target.value)}
              />
            </Field>
            <Field label="Número" className="md:col-span-1">
              <Input
                value={data.endereco_numero}
                onChange={(e) => update("endereco_numero", e.target.value)}
              />
            </Field>
            <Field label="Complemento" className="md:col-span-2">
              <Input
                value={data.endereco_complemento}
                onChange={(e) => update("endereco_complemento", e.target.value)}
              />
            </Field>
            <Field label="Bairro" className="md:col-span-3">
              <Input
                value={data.endereco_bairro}
                onChange={(e) => update("endereco_bairro", e.target.value)}
              />
            </Field>
            <Field label="Cidade" className="md:col-span-4">
              <Input
                value={data.endereco_cidade}
                onChange={(e) => update("endereco_cidade", e.target.value)}
              />
            </Field>
            <Field label="UF" className="md:col-span-2">
              <Input
                maxLength={2}
                value={data.endereco_uf}
                onChange={(e) => update("endereco_uf", e.target.value.toUpperCase())}
              />
            </Field>
          </div>
          <Toggle
            label="Mostrar endereço completo na página pública"
            checked={data.mostrar_endereco_publico}
            onChange={(v) => update("mostrar_endereco_publico", v)}
          />
        </Section>
      )}

      {showSection("condicoes") && data.finalidade !== "aluguel" && (
        <Section title="Condições">
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle
              label="Aceita financiamento"
              checked={data.aceita_financiamento}
              onChange={(v) => update("aceita_financiamento", v)}
            />
            <Toggle
              label="Aceita permuta"
              checked={data.aceita_permuta}
              onChange={(v) => update("aceita_permuta", v)}
            />
          </div>
        </Section>
      )}

      {showSection("corretor") && (
        <Section title="Corretor responsável">
          <Field label="Corretor">
            <Popover open={corretorOpen} onOpenChange={setCorretorOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={corretorOpen}
                  className="w-full justify-between font-normal"
                >
                  {data.corretor_responsavel_id
                    ? (corretores.find((c) => c.id === data.corretor_responsavel_id)?.nome ??
                      "Sem corretor responsável")
                    : "Sem corretor responsável"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar corretor…" />
                  <CommandList>
                    <CommandEmpty>Nenhum corretor encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          update("corretor_responsavel_id", null);
                          setCorretorOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${data.corretor_responsavel_id ? "opacity-0" : "opacity-100"}`}
                        />
                        Sem corretor responsável
                      </CommandItem>
                      {corretores.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.nome}
                          onSelect={() => {
                            update("corretor_responsavel_id", c.id);
                            setCorretorOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${data.corretor_responsavel_id === c.id ? "opacity-100" : "opacity-0"}`}
                          />
                          {c.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {corretores.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhum corretor cadastrado ainda. Cadastre em{" "}
                <span className="font-medium">Corretores</span> para vincular.
              </p>
            )}
          </Field>
        </Section>
      )}

      {showSection("marca_dagua") && (
        <Section title="Marca d'água">
          {tenantLogoUrl ? (
            <>
              <Toggle
                label="Aplicar a logo da imobiliária sobre as fotos deste imóvel"
                checked={data.marca_dagua_ativa}
                onChange={(v) => update("marca_dagua_ativa", v)}
              />
              <p className="text-xs text-muted-foreground">
                Protege as fotos contra cópia por concorrentes. Pode ser ligada/desligada a qualquer
                momento, inclusive depois de publicado — as fotos originais nunca são perdidas.
              </p>
              {data.marca_dagua_ativa && <WatermarkPreview logoUrl={tenantLogoUrl} />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Configure a logo da imobiliária em{" "}
              <a href="/app/site" className="font-medium text-primary underline underline-offset-2">
                Site → Marca
              </a>{" "}
              para poder aplicar marca d'água nas fotos deste imóvel.
            </p>
          )}
        </Section>
      )}

      {showSection("campos_personalizados") && customFields.length > 0 && (
        <Section title="Campos personalizados">
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => {
              const val = data.custom_data?.[f.chave];
              const setVal = (v: any) =>
                update("custom_data", { ...(data.custom_data ?? {}), [f.chave]: v });
              return (
                <Field key={f.id} label={f.rotulo + (f.obrigatorio ? " *" : "")}>
                  {f.tipo === "boolean" ? (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                      <span className="text-sm">Sim</span>
                      <Switch checked={!!val} onCheckedChange={setVal} />
                    </div>
                  ) : f.tipo === "select" ? (
                    <Select value={val ?? ""} onValueChange={setVal}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.opcoes ?? []).map((o: string) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={f.tipo === "numero" ? "number" : f.tipo === "data" ? "date" : "text"}
                      value={val ?? ""}
                      onChange={(e) => setVal(e.target.value)}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </Section>
      )}

      {showSection("situacao") && (
        <Section title="Situação do imóvel">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                statusInfo.tone === "published"
                  ? "bg-emerald-500/15 text-emerald-600"
                  : statusInfo.tone === "draft"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-500/15 text-amber-600"
              }`}
            >
              {statusInfo.tone === "published" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : statusInfo.tone === "draft" ? (
                <FileText className="h-5 w-5" />
              ) : (
                <Ban className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{statusInfo.title}</p>
              <p className="text-xs text-muted-foreground">{statusInfo.desc}</p>
            </div>
          </div>
          <details className="rounded-lg border border-border bg-background px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Status comercial (avançado)
            </summary>
            <div className="mt-2">
              <Select value={data.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Use para marcar como vendido, alugado ou reservado. Imóveis publicados precisam
                estar com status "Ativo".
              </p>
            </div>
          </details>
        </Section>
      )}

      {showSection("situacao") && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => submitWith("save")}
          >
            {submitting && pendingAction === "save"
              ? "Salvando…"
              : mode === "create"
                ? "Salvar rascunho"
                : "Salvar alterações"}
          </Button>
          {isPublished ? (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => submitWith("unpublish")}
            >
              {submitting && pendingAction === "unpublish" ? "Despublicando…" : "Despublicar"}
            </Button>
          ) : (
            <Button type="button" disabled={submitting} onClick={() => submitWith("publish")}>
              <Globe className="mr-2 h-4 w-4" />
              {submitting && pendingAction === "publish" ? "Publicando…" : "Publicar imóvel"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Gera uma foto de exemplo (gradiente + "janelas") direto via canvas — não há
// nenhuma foto de imóvel genérica no bundle pra reaproveitar — e roda o mesmo
// aplicarMarcaDagua() usado no upload real, garantindo que a prévia nunca
// diverge do resultado real em produção.
function criarFotoExemplo(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#7dd3fc");
  gradient.addColorStop(1, "#e0f2fe");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
  ctx.fillStyle = "#94a3b8";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(60 + i * 100, canvas.height * 0.62, 50, 50);
  }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob!], "exemplo.webp", { type: "image/webp" }));
    }, "image/webp");
  });
}

function WatermarkPreview({ logoUrl }: { logoUrl: string }) {
  const [antes, setAntes] = useState<string | null>(null);
  const [depois, setDepois] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "sem-marca">("loading");
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const original = await criarFotoExemplo();
      const antesUrl = URL.createObjectURL(original);
      objectUrls.current.push(antesUrl);
      const { file, watermarked } = await aplicarMarcaDagua(original, logoUrl);
      if (cancelled) return;
      const depoisUrl = URL.createObjectURL(file);
      objectUrls.current.push(depoisUrl);
      setAntes(antesUrl);
      setDepois(depoisUrl);
      setStatus(watermarked ? "ok" : "sem-marca");
    })();
    return () => {
      cancelled = true;
      objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrls.current = [];
    };
  }, [logoUrl]);

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Droplets className="h-3.5 w-3.5" /> Prévia (imagem de exemplo)
      </p>
      {status === "loading" ? (
        <p className="text-xs text-muted-foreground">Gerando prévia…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <img
              src={antes ?? undefined}
              alt="Antes"
              className="w-full rounded-md border border-border"
            />
            <p className="mt-1 text-center text-xs text-muted-foreground">Original</p>
          </div>
          <div>
            <img
              src={depois ?? undefined}
              alt="Depois"
              className="w-full rounded-md border border-border"
            />
            <p className="mt-1 text-center text-xs text-muted-foreground">Com marca d'água</p>
          </div>
        </div>
      )}
      {status === "sem-marca" && (
        <p className="mt-2 text-xs text-amber-600">
          Não foi possível carregar a logo para a prévia agora (ex.: bloqueio de CORS) — o mesmo
          pode acontecer no upload real, que sobe a foto sem marca nesse caso.
        </p>
      )}
    </div>
  );
}
