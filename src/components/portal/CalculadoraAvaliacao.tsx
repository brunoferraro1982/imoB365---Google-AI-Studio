import { useMemo, useState } from "react";
import { Home, MapPin, Ruler, AlertTriangle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  estimarValorImovel,
  TIPO_AVALIACAO_LABEL,
  PADRAO_LABEL,
  CONSERVACAO_LABEL,
  type TipoImovelAvaliacao,
  type FinalidadeAvaliacao,
  type PadraoImovel,
  type ConservacaoImovel,
} from "@/lib/avaliacaoImovel";

// Calculadora "Quanto vale o seu imóvel?" — usada na página
// /calculadora-avaliacao e no painel de vidro aberto pelo widget da home.

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Math.max(v, 0));

interface CepInfo {
  cidade: string;
  uf: string;
  bairro: string;
}

export function CalculadoraAvaliacao({ cabecalho = true }: { cabecalho?: boolean }) {
  const [cep, setCep] = useState("");
  const [cepInfo, setCepInfo] = useState<CepInfo | null>(null);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [metragem, setMetragem] = useState<number>(70);
  const [tipo, setTipo] = useState<TipoImovelAvaliacao>("apartamento");
  const [finalidade, setFinalidade] = useState<FinalidadeAvaliacao>("venda");
  const [padrao, setPadrao] = useState<PadraoImovel>("medio");
  const [conservacao, setConservacao] = useState<ConservacaoImovel>("seminovo");

  async function handleCepChange(value: string) {
    const masked = value
      .replace(/\D/g, "")
      .slice(0, 8)
      .replace(/(\d{5})(\d)/, "$1-$2");
    setCep(masked);
    const clean = masked.replace(/\D/g, "");
    if (clean.length !== 8) {
      setCepInfo(null);
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const json = await res.json();
      if (json.erro) {
        setCepInfo(null);
        setCepStatus("erro");
        return;
      }
      setCepInfo({
        cidade: json.localidade ?? "",
        uf: json.uf ?? "",
        bairro: json.bairro ?? "",
      });
      setCepStatus("ok");
    } catch {
      setCepInfo(null);
      setCepStatus("erro");
    }
  }

  const resultado = useMemo(
    () =>
      estimarValorImovel({
        metragem,
        tipo,
        finalidade,
        padrao,
        conservacao,
        cidade: cepInfo?.cidade,
        uf: cepInfo?.uf,
      }),
    [metragem, tipo, finalidade, padrao, conservacao, cepInfo],
  );

  const localizacaoLabel = cepInfo
    ? [cepInfo.bairro, cepInfo.cidade, cepInfo.uf].filter(Boolean).join(", ")
    : null;

  return (
    <div>
      {cabecalho && (
        <div className="mb-5 flex items-center gap-2.5">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Quanto vale meu imóvel?</h2>
            <p className="text-[10px] text-muted-foreground leading-none">
              Estimativa por localização e metragem
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="aval-cep" className="text-xs font-bold text-muted-foreground">
            CEP do imóvel
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="aval-cep"
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              className="pl-8 font-semibold text-sm"
              placeholder="Ex: 11700-000"
              inputMode="numeric"
            />
            {cepStatus === "loading" && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {cepStatus === "ok" && localizacaoLabel && (
            <span className="text-[10px] text-emerald-700 leading-tight block">
              📍 {localizacaoLabel}
            </span>
          )}
          {cepStatus === "erro" && (
            <span className="text-[10px] text-destructive leading-tight block">
              CEP não encontrado — usaremos a média nacional.
            </span>
          )}
          {cepStatus === "idle" && (
            <span className="text-[10px] text-muted-foreground leading-tight block">
              Usamos o CEP só para localizar a região — nada é salvo.
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoImovelAvaliacao)}>
              <SelectTrigger className="text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_AVALIACAO_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Finalidade</Label>
            <Select
              value={finalidade}
              onValueChange={(v) => setFinalidade(v as FinalidadeAvaliacao)}
            >
              <SelectTrigger className="text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="aval-m2" className="text-xs font-bold text-muted-foreground">
            Metragem (área privativa, m²)
          </Label>
          <div className="relative">
            <Ruler className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="aval-m2"
              type="number"
              value={metragem || ""}
              onChange={(e) => setMetragem(Number(e.target.value))}
              className="pl-8 font-semibold text-sm"
              placeholder="Ex: 70"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Padrão</Label>
            <Select value={padrao} onValueChange={(v) => setPadrao(v as PadraoImovel)}>
              <SelectTrigger className="text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PADRAO_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Conservação</Label>
            <Select
              value={conservacao}
              onValueChange={(v) => setConservacao(v as ConservacaoImovel)}
            >
              <SelectTrigger className="text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONSERVACAO_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t border-border pt-4 mt-2 space-y-3.5">
          <div className="flex justify-between items-center bg-muted/45 p-3.5 rounded-xl border border-border/60">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase leading-none block">
                {finalidade === "venda" ? "Valor estimado" : "Aluguel estimado"}
              </span>
              <span className="text-[11px] text-muted-foreground leading-none block">
                Faixa de referência
              </span>
            </div>
            <span className="text-base font-extrabold text-emerald-600 text-right leading-tight">
              {finalidade === "venda"
                ? formatBRL(resultado.valorMedio)
                : `${formatBRL(resultado.aluguelMedio ?? 0)}/mês`}
            </span>
          </div>

          <div className="flex justify-between items-center p-3 rounded-xl border border-dashed border-border/80 text-[10px]">
            <span className="text-muted-foreground font-bold uppercase">Faixa (mín. — máx.)</span>
            <span className="font-semibold text-foreground text-right">
              {finalidade === "venda"
                ? `${formatBRL(resultado.valorMinimo)} — ${formatBRL(resultado.valorMaximo)}`
                : `${formatBRL(resultado.aluguelMinimo ?? 0)} — ${formatBRL(resultado.aluguelMaximo ?? 0)}`}
            </span>
          </div>

          {finalidade === "locacao" && (
            <div className="flex justify-between items-center p-3 rounded-xl border border-border/60 text-[10px]">
              <span className="text-muted-foreground font-bold uppercase">
                Valor de mercado do imóvel (venda)
              </span>
              <span className="font-semibold text-foreground">
                {formatBRL(resultado.valorMedio)}
              </span>
            </div>
          )}

          <span className="text-[10px] text-muted-foreground block">
            Base: {formatBRL(resultado.valorM2Ajustado)}/m² ·{" "}
            {resultado.fonteRegional === "cidade"
              ? "média da cidade informada"
              : resultado.fonteRegional === "estado"
                ? "média do estado (cidade não mapeada)"
                : "média nacional (informe um CEP válido para refinar)"}
          </span>
        </div>

        <div className="flex gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-400">
            <strong>Isto é uma estimativa de referência</strong>, calculada por médias de mercado —
            não é um laudo de avaliação. O valor real pode variar para mais ou para menos conforme
            vista, sol, reformas, documentação e negociação. Para um número confiável na hora de
            anunciar ou negociar, fale com um corretor credenciado.
          </p>
        </div>
      </div>
    </div>
  );
}
