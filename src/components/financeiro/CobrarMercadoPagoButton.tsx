import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Copy } from "lucide-react";
import { getMercadoPagoConnectionStatus } from "@/lib/mercadopagoOAuth.functions";
import {
  getCobrancaMercadoPago,
  criarCobrancaMercadoPago,
} from "@/lib/cobrancaMercadoPago.functions";

// Botão compartilhado "Cobrar via Mercado Pago" — usado tanto no
// cronograma de parcelas de venda (ParcelasSection.tsx) quanto num
// lançamento de locação (app.financeiro.$id.tsx). Só aparece quando o
// tenant já conectou a conta do Mercado Pago (Fase 3 parte 1); se já existe
// uma cobrança pendente pra este item, mostra o link já gerado em vez de
// criar outro (a unicidade também é garantida no banco).
export function CobrarMercadoPagoButton({
  origemTipo,
  origemId,
}: {
  origemTipo: "parcela" | "lancamento";
  origemId: string;
}) {
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [linkPagamento, setLinkPagamento] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const statusFn = useServerFn(getMercadoPagoConnectionStatus);
  const cobrancaFn = useServerFn(getCobrancaMercadoPago);
  const criarFn = useServerFn(criarCobrancaMercadoPago);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [status, cobranca] = await Promise.all([
        statusFn(),
        cobrancaFn({ data: { origemTipo, origemId } }),
      ]);
      if (cancelled) return;
      setConectado(status.connected);
      setLinkPagamento(cobranca.linkPagamento);
    })();
    return () => {
      cancelled = true;
    };
  }, [origemTipo, origemId]);

  async function cobrar() {
    setLoading(true);
    try {
      const { linkPagamento: link } = await criarFn({ data: { origemTipo, origemId } });
      setLinkPagamento(link);
      toast.success("Cobrança gerada — copie o link ou abra pra enviar ao cliente");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar cobrança");
    } finally {
      setLoading(false);
    }
  }

  function copiarLink() {
    if (!linkPagamento) return;
    navigator.clipboard.writeText(linkPagamento);
    toast.success("Link copiado");
  }

  if (!conectado) return null;

  if (linkPagamento) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(linkPagamento, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="mr-1 h-4 w-4" /> Ver cobrança
        </Button>
        <Button variant="ghost" size="sm" onClick={copiarLink} title="Copiar link">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={cobrar} disabled={loading}>
      <CreditCard className="mr-1 h-4 w-4" /> {loading ? "Gerando…" : "Cobrar via Mercado Pago"}
    </Button>
  );
}
