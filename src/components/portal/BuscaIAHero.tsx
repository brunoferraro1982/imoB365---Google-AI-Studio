import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bath,
  Bed,
  Car,
  ChevronDown,
  Dumbbell,
  KeyRound,
  Loader2,
  MapPin,
  Maximize2,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { interpretarBuscaConversacional } from "@/lib/ai.functions";
import { BUSCA_IA_STORAGE_KEY } from "@/lib/buscaIa";

// Caixa de busca da home no formato dos assistentes de IA (ChatGPT, Gemini,
// Claude): o visitante escreve o que quer e a IA da imoB365 transforma o
// pedido nos MESMOS filtros da busca de sempre (/buscar) — via
// interpretarBuscaConversacional, a mesma função do painel de IA do /buscar.
// Se a IA falhar (limite de uso, indisponível), um interpretador local
// simples extrai o básico do texto: o visitante nunca fica sem resultado.
// A busca antiga continua disponível como "Pesquisa tradicional".

const EXEMPLOS = [
  "Apartamento de 2 quartos perto da praia em Praia Grande até R$ 500 mil",
  "Casa com piscina e 3 suítes em Santos para comprar",
  "Quero alugar um apartamento mobiliado em São Paulo até R$ 4 mil",
  "Cobertura com churrasqueira e 2 vagas no Canto do Forte",
];

const SUGESTOES = [
  {
    icon: Waves,
    label: "Perto da praia",
    texto: "Apartamento perto da praia em Praia Grande até R$ 450 mil",
  },
  {
    icon: Users,
    label: "Para a família",
    texto: "Casa com 3 quartos, quintal e 2 vagas para comprar",
  },
  {
    icon: KeyRound,
    label: "Para alugar",
    texto: "Apartamento mobiliado para alugar até R$ 3.500 por mês",
  },
  {
    icon: Dumbbell,
    label: "Com lazer",
    texto: "Apartamento com piscina, academia e churrasqueira",
  },
];

const PASSOS = ["Entendendo seu pedido…", "Aplicando os filtros…", "Buscando os imóveis…"];

type Finalidade = "todos" | "venda" | "aluguel";

type Filtros = {
  q?: string;
  finalidade?: string;
  tipo?: string;
  quartos?: string;
  banheiros?: string;
  precoMin?: string;
  precoMax?: string;
  areaMin?: string;
  caracteristicas?: string;
};

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "500 mil" → 500000 · "1,2 milhão" → 1200000 · "R$ 450.000" → 450000 */
function valorEmReais(trecho: string): string | undefined {
  // "milhão" antes de "mil" na alternância — senão "1,2 milhão" casa só "mil"
  const m = semAcento(trecho).match(/(\d+(?:[.,]\d+)*)\s*(milh(?:ao|oes)|mil|mi|k)?/);
  if (!m) return undefined;
  const bruto = m[1];
  const unidade = m[2] ?? "";
  const mult = unidade.startsWith("milh") || unidade === "mi" ? 1e6 : unidade ? 1e3 : 1;
  const n =
    mult > 1
      ? Number(bruto.replace(/\./g, "").replace(",", ".")) * mult
      : Number(bruto.replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : undefined;
}

/** Plano B sem IA: extrai tipo, quartos, preço, finalidade e local do texto. */
function interpretarLocal(texto: string, finalidadeEscolhida: Finalidade): Filtros {
  const t = semAcento(texto);
  const f: Filtros = {};
  const tipos: [RegExp, string][] = [
    [/\bcobertura/, "cobertura"],
    [/\bapartamento|\bapto\b|\bape\b|\bkitnet|\bstudio/, "apartamento"],
    [/\bcasa|\bsobrado/, "casa"],
    [/\bterreno|\blote\b/, "terreno"],
    [/\bsala comercial|\bloja|\bcomercial|\bgalpao/, "comercial"],
  ];
  f.tipo = tipos.find(([re]) => re.test(t))?.[1];
  f.quartos = t.match(/(\d+)\s*(?:quartos?|dorm|suites?)/)?.[1];
  const ate = t.match(
    /(?:ate|max(?:imo)?|no maximo)\s*(?:r\$)?\s*([\d.,]+\s*(?:milh\w*|mil|mi|k)?)/,
  );
  if (ate) f.precoMax = valorEmReais(ate[1]);
  if (/\balug|\blocac/.test(t)) f.finalidade = "aluguel";
  else if (/\bcompr|\bvenda|\bcomprar/.test(t)) f.finalidade = "venda";
  else if (finalidadeEscolhida !== "todos") f.finalidade = finalidadeEscolhida;
  // Local: o que vem depois de "em / no / na" até um conector
  const local = texto.match(
    /\b(?:em|no|na|nos|nas)\s+([A-ZÀ-Ú][\wÀ-ú'-]*(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ú][\wÀ-ú'-]*)*)/,
  );
  if (local) f.q = local[1];
  return f;
}

export function BuscaIAHero() {
  const navigate = useNavigate();
  const interpretar = useServerFn(interpretarBuscaConversacional);

  const [pedido, setPedido] = useState("");
  const [finalidade, setFinalidade] = useState<Finalidade>("todos");
  const [carregando, setCarregando] = useState(false);
  const [passo, setPasso] = useState(0);
  const [exemplo, setExemplo] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pesquisa tradicional (formulário de sempre)
  const [tradicionalAberta, setTradicionalAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [finalidadeTrad, setFinalidadeTrad] = useState<"venda" | "aluguel">("venda");
  const [adv, setAdv] = useState({
    tipo: "",
    quartos: "",
    banheiros: "",
    vagas: "",
    precoMin: "",
    precoMax: "",
    areaMin: "",
    bairro: "",
  });

  // Exemplos que se alternam no placeholder enquanto a caixa está vazia
  useEffect(() => {
    if (pedido) return;
    const id = setInterval(() => setExemplo((e) => (e + 1) % EXEMPLOS.length), 3500);
    return () => clearInterval(id);
  }, [pedido]);

  // Passos visíveis enquanto a IA trabalha
  useEffect(() => {
    if (!carregando) return;
    setPasso(0);
    const id = setInterval(() => setPasso((p) => Math.min(p + 1, PASSOS.length - 1)), 1100);
    return () => clearInterval(id);
  }, [carregando]);

  // Textarea cresce com o texto (até ~5 linhas)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [pedido]);

  function irParaResultados(filtros: Filtros, resposta: string) {
    try {
      sessionStorage.setItem(
        BUSCA_IA_STORAGE_KEY,
        JSON.stringify({ pedido: pedido.trim(), resposta }),
      );
    } catch {
      /* storage bloqueado: segue sem a faixa no /buscar */
    }
    const search = Object.fromEntries(
      Object.entries(filtros).filter(([, v]) => v != null && v !== "" && v !== "todos"),
    );
    navigate({ to: "/buscar", search: search as never });
  }

  async function buscarComIA(texto?: string) {
    const msg = (texto ?? pedido).trim();
    if (texto) setPedido(texto);
    if (msg.length < 3) {
      setErro("Conte um pouco mais sobre o imóvel que você procura.");
      textareaRef.current?.focus();
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const { bot } = await interpretar({ data: { mensagem: msg.slice(0, 400) } });
      const fin =
        bot.finalidade && bot.finalidade !== "todos"
          ? bot.finalidade
          : finalidade !== "todos"
            ? finalidade
            : undefined;
      irParaResultados(
        {
          q: bot.q || undefined,
          finalidade: fin,
          tipo: bot.tipo || undefined,
          quartos: bot.quartos || undefined,
          banheiros: bot.banheiros || undefined,
          precoMin: bot.precoMin || undefined,
          precoMax: bot.precoMax || undefined,
          areaMin: bot.areaMin || undefined,
          caracteristicas: Array.isArray(bot.caracteristicasSelecionadas)
            ? bot.caracteristicasSelecionadas.join(",") || undefined
            : undefined,
        },
        bot.resposta_amigavel || "Apliquei os filtros conforme o seu pedido.",
      );
    } catch (err) {
      console.error("busca IA falhou, usando interpretador local:", err);
      irParaResultados(
        interpretarLocal(msg, finalidade),
        "Fiz uma leitura rápida do seu pedido e apliquei os filtros principais — ajuste à vontade.",
      );
    }
    // sem setCarregando(false): a navegação desmonta a home
  }

  return (
    <div className="mt-12 w-full max-w-4xl">
      <style>{`
        @keyframes buscaIaBorda { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        .busca-ia-borda { background-size: 200% 200%; animation: buscaIaBorda 6s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .busca-ia-borda { animation: none; } }
      `}</style>

      {/* ---------- caixa de IA ---------- */}
      <div className="busca-ia-borda rounded-[28px] bg-gradient-to-r from-primary via-fuchsia-500 to-violet-600 p-[2px] shadow-xl shadow-primary/15">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void buscarComIA();
          }}
          className="relative rounded-[26px] bg-white p-4 dark:bg-card md:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-violet-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Busca inteligente com IA
            </span>
            <div
              role="radiogroup"
              aria-label="Comprar ou alugar"
              className="inline-flex rounded-full bg-muted/70 p-0.5 text-xs font-semibold"
            >
              {(
                [
                  ["todos", "Tanto faz"],
                  ["venda", "Comprar"],
                  ["aluguel", "Alugar"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={finalidade === v}
                  onClick={() => setFinalidade(v)}
                  className={`rounded-full px-3 py-1 transition ${
                    finalidade === v
                      ? "bg-white text-foreground shadow-sm dark:bg-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-end gap-3 rounded-2xl border border-border bg-neutral-50/60 px-4 py-3 transition focus-within:border-primary/40 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/10 dark:bg-background">
            <textarea
              ref={textareaRef}
              rows={2}
              value={pedido}
              onChange={(e) => {
                setPedido(e.target.value);
                if (erro) setErro(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void buscarComIA();
                }
              }}
              disabled={carregando}
              maxLength={400}
              aria-label="Descreva o imóvel que você procura"
              placeholder={`Descreva o imóvel dos seus sonhos… ex.: “${EXEMPLOS[exemplo]}”`}
              className="max-h-[168px] min-h-[92px] md:min-h-[56px] w-full resize-none bg-transparent text-base font-medium leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 md:text-lg"
            />
            <button
              type="submit"
              disabled={carregando}
              aria-label="Buscar com IA"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-600 text-white shadow-lg transition hover:scale-105 hover:shadow-primary/30 disabled:cursor-wait disabled:opacity-80"
            >
              {carregando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-5 w-5 stroke-[2.5px]" />
              )}
            </button>
          </div>

          {carregando ? (
            <div
              className="mt-3 flex items-center gap-2 px-1 text-sm font-semibold text-primary"
              aria-live="polite"
            >
              <Sparkles className="h-4 w-4 animate-pulse" />
              {PASSOS[passo]}
            </div>
          ) : erro ? (
            <p className="mt-3 px-1 text-sm font-medium text-red-600">{erro}</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs font-semibold text-muted-foreground">Experimente:</span>
              {SUGESTOES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => void buscarComIA(s.texto)}
                  title={s.texto}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary dark:bg-background"
                >
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <p className="mt-3 px-1 text-[11px] leading-snug text-muted-foreground/80">
            A IA da imoB365 entende o seu pedido e aplica os filtros da busca por você — dá para
            ajustar tudo nos resultados.{" "}
            <span className="hidden sm:inline">Enter para buscar · Shift+Enter quebra linha.</span>
          </p>
        </form>
      </div>

      {/* ---------- pesquisa tradicional ---------- */}
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setTradicionalAberta((v) => !v)}
          className="group flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-primary md:text-sm"
          aria-expanded={tradicionalAberta}
          aria-controls="pesquisa-tradicional"
        >
          <SlidersHorizontal className="h-4 w-4 transition-transform group-hover:scale-110" />
          Prefere filtros? Use a pesquisa tradicional
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${tradicionalAberta ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {tradicionalAberta && (
        <div
          id="pesquisa-tradicional"
          className="mt-4 rounded-3xl border border-border bg-white p-4.5 shadow-md dark:bg-card"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 pb-2">
            <span className="pb-2.5 text-sm font-extrabold text-foreground">
              Pesquisa tradicional
            </span>
            <div className="flex gap-6">
              {(["venda", "aluguel"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFinalidadeTrad(f)}
                  type="button"
                  className={`relative pb-2.5 text-sm font-bold transition-all ${
                    finalidadeTrad === f
                      ? "font-extrabold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "venda" ? "Comprar" : "Alugar"}
                  {finalidadeTrad === f && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <form action="/buscar" method="get" className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-neutral-50/50 px-4 py-2.5 shadow-2xs transition-all hover:border-primary/20 dark:bg-background">
                <MapPin className="h-5 w-5 shrink-0 text-muted-foreground/80" />
                <Input
                  name="q"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Cidade, bairro ou referência (ex: Pinheiros, São Paulo)"
                  className="h-9 w-full border-0 bg-transparent p-0 text-sm font-medium shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                />
              </div>
              <input type="hidden" name="finalidade" value={finalidadeTrad} />
              <Button
                type="submit"
                size="lg"
                className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-7 font-bold tracking-wide text-white shadow-sm transition-all duration-200 hover:scale-101 hover:bg-[#d65e1b]"
              >
                <Search className="h-4 w-4 stroke-[2.5px]" /> Buscar imóveis
              </Button>
            </div>

            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <Field label="Bairro">
                <Input
                  name="bairro"
                  value={adv.bairro}
                  onChange={(e) => setAdv({ ...adv, bairro: e.target.value })}
                  placeholder="Ex: Moema"
                />
              </Field>
              <Field label="Tipo de imóvel">
                <select
                  name="tipo"
                  value={adv.tipo}
                  onChange={(e) => setAdv({ ...adv, tipo: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Qualquer</option>
                  <option value="apartamento">Apartamento</option>
                  <option value="casa">Casa</option>
                  <option value="cobertura">Cobertura</option>
                  <option value="terreno">Terreno</option>
                  <option value="comercial">Comercial</option>
                  <option value="rural">Rural</option>
                </select>
              </Field>
              <Field label="Quartos" icon={<Bed className="h-3.5 w-3.5" />}>
                <select
                  name="quartos"
                  value={adv.quartos}
                  onChange={(e) => setAdv({ ...adv, quartos: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Qualquer</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                </select>
              </Field>
              <Field label="Banheiros" icon={<Bath className="h-3.5 w-3.5" />}>
                <select
                  name="banheiros"
                  value={adv.banheiros}
                  onChange={(e) => setAdv({ ...adv, banheiros: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Qualquer</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                </select>
              </Field>
              <Field label="Vagas de garagem" icon={<Car className="h-3.5 w-3.5" />}>
                <select
                  name="vagas"
                  value={adv.vagas}
                  onChange={(e) => setAdv({ ...adv, vagas: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Qualquer</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                </select>
              </Field>
              <Field label="Área mín. (m²)" icon={<Maximize2 className="h-3.5 w-3.5" />}>
                <Input
                  type="number"
                  name="areaMin"
                  value={adv.areaMin}
                  onChange={(e) => setAdv({ ...adv, areaMin: e.target.value })}
                  placeholder="Ex: 60"
                  min={0}
                />
              </Field>
              <Field label="Valor mínimo (R$)">
                <Input
                  type="number"
                  name="precoMin"
                  value={adv.precoMin}
                  onChange={(e) => setAdv({ ...adv, precoMin: e.target.value })}
                  placeholder="0"
                  min={0}
                />
              </Field>
              <Field label="Valor máximo (R$)">
                <Input
                  type="number"
                  name="precoMax"
                  value={adv.precoMax}
                  onChange={(e) => setAdv({ ...adv, precoMax: e.target.value })}
                  placeholder="Sem limite"
                  min={0}
                />
              </Field>

              <div className="flex items-end gap-2 sm:col-span-2 md:col-span-3 lg:col-span-4">
                <Button type="submit" className="flex-1 md:flex-none">
                  <Search className="mr-2 h-4 w-4" /> Aplicar filtros
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setAdv({
                      tipo: "",
                      quartos: "",
                      banheiros: "",
                      vagas: "",
                      precoMin: "",
                      precoMax: "",
                      areaMin: "",
                      bairro: "",
                    })
                  }
                >
                  Limpar
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
