import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Home, Sparkles } from "lucide-react";
import { AssistenteChat } from "@/components/ai/AssistenteChat";
import { CalculadoraAvaliacao } from "@/components/portal/CalculadoraAvaliacao";
import { PainelVidro } from "@/components/portal/PainelVidro";

type Ferramenta = "ia" | "avaliacao";

// Hashes antigos continuam funcionando: menus e /perguntas-frequentes linkam
// para "/#assistente-ia" (a seção foi substituída por estes widgets).
const HASH: Record<Ferramenta, string> = { ia: "assistente-ia", avaliacao: "avaliacao" };

// Box de widgets (estilo tela de celular) ao lado da busca inteligente da home:
// cada tile abre a ferramenta num painel de vidro por cima da página.
export function WidgetsFerramentas() {
  const [aberta, setAberta] = useState<Ferramenta | null>(null);

  useEffect(() => {
    const abrirPeloHash = () => {
      const h = window.location.hash.slice(1);
      if (h === HASH.ia) setAberta("ia");
      else if (h === HASH.avaliacao) setAberta("avaliacao");
    };
    abrirPeloHash();
    window.addEventListener("hashchange", abrirPeloHash);
    return () => window.removeEventListener("hashchange", abrirPeloHash);
  }, []);

  const fechar = (aberto: boolean) => {
    if (aberto) return;
    setAberta(null);
    if (Object.values(HASH).includes(window.location.hash.slice(1))) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  return (
    <>
      <div className="grid h-full grid-cols-2 gap-3 md:grid-cols-1 md:grid-rows-2 md:gap-4">
        <Widget
          onClick={() => setAberta("ia")}
          icone={<Sparkles className="h-5 w-5 text-white" />}
          corIcone="from-[#ed7d31] to-[#b4520f]"
          brilho="bg-[radial-gradient(160px_120px_at_100%_0%,rgba(237,125,49,.30),transparent_70%)]"
          titulo="Pergunte pra nossa IA"
          texto="Financiamento, ITBI, documentos — resposta na hora"
        />
        <Widget
          onClick={() => setAberta("avaliacao")}
          icone={<Home className="h-5 w-5 text-white" />}
          corIcone="from-[#346ed6] to-[#0f1e3a]"
          brilho="bg-[radial-gradient(160px_120px_at_100%_0%,rgba(52,110,214,.28),transparent_70%)]"
          titulo="Quanto vale o seu imóvel?"
          texto="Estimativa por CEP e metragem em segundos"
        />
      </div>

      <PainelVidro
        aberto={aberta === "ia"}
        onAbertoChange={fechar}
        titulo="Pergunte pra nossa IA"
        subtitulo="Financiamento, ITBI, mudança, documentação — tire dúvidas na hora."
        icone={<Sparkles className="h-5 w-5 text-primary" />}
      >
        <div className="-m-4">
          <AssistenteChat compact />
        </div>
      </PainelVidro>

      <PainelVidro
        aberto={aberta === "avaliacao"}
        onAbertoChange={fechar}
        titulo="Quanto vale o seu imóvel?"
        subtitulo="Estimativa de referência por localização, metragem, tipo e padrão."
        icone={<Home className="h-5 w-5 text-[#346ed6]" />}
      >
        <CalculadoraAvaliacao cabecalho={false} />
      </PainelVidro>
    </>
  );
}

function Widget({
  onClick,
  icone,
  corIcone,
  brilho,
  titulo,
  texto,
}: {
  onClick: () => void;
  icone: ReactNode;
  corIcone: string;
  brilho: string;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="glass-fosco group relative flex h-full min-h-[132px] flex-col justify-between overflow-hidden rounded-[26px] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:min-h-0 md:flex-row md:items-center md:justify-start md:gap-3.5"
    >
      <span className={`pointer-events-none absolute inset-0 ${brilho}`} />
      <ArrowUpRight className="absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
      <span
        className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br ${corIcone} shadow-md`}
      >
        {icone}
      </span>
      <span className="relative mt-3 block md:mt-0 md:pr-4">
        <span className="font-brand-display block text-[15px] font-extrabold leading-tight tracking-tight text-foreground md:text-base">
          {titulo}
        </span>
        <span className="mt-1 block text-[11.5px] leading-snug text-muted-foreground">{texto}</span>
      </span>
    </button>
  );
}
