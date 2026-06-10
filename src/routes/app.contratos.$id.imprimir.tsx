import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/contratos/$id/imprimir")({
  component: ImprimirContrato,
});

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function partesByPapel(partes: any[], papel: string) {
  return (
    partes
      .filter((p) => p.papel === papel)
      .map((p) => {
        const extras = [p.documento && `CPF/CNPJ ${p.documento}`].filter(Boolean).join(", ");
        return extras ? `${p.nome} (${extras})` : p.nome;
      })
      .join("; ") || "—"
  );
}

function interpolate(template: string, ctx: Record<string, string>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => ctx[key] ?? `{{${key}}}`);
}

function ImprimirContrato() {
  const { id } = Route.useParams();
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contrato, setContrato] = useState<any>(null);
  const [imovel, setImovel] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [partes, setPartes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: p }, { data: t }, { data: tpls }] = await Promise.all([
        supabase.from("contratos").select("*").eq("id", id).maybeSingle(),
        supabase.from("contrato_partes").select("*").eq("contrato_id", id).order("created_at"),
        supabase
          .from("tenants")
          .select("nome,cnpj,creci_juridico")
          .eq("id", tenantId)
          .maybeSingle(),
        supabase
          .from("contrato_templates")
          .select("id,nome,tipo,conteudo")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .order("nome"),
      ]);
      setContrato(c);
      setPartes(p ?? []);
      setTenant(t);
      setTemplates(tpls ?? []);
      if (c?.imovel_id) {
        const { data: i } = await supabase
          .from("imoveis")
          .select("*")
          .eq("id", c.imovel_id)
          .maybeSingle();
        setImovel(i);
      }
      const sugest = (tpls ?? []).find((x: any) => x.tipo === c?.tipo);
      if (sugest) setTemplateId(sugest.id);
      setLoading(false);
    })();
  }, [id, tenantId]);

  const enderecoImovel = imovel
    ? [
        imovel.endereco_logradouro,
        imovel.endereco_numero,
        imovel.endereco_bairro,
        imovel.endereco_cidade && `${imovel.endereco_cidade}/${imovel.endereco_uf ?? ""}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

  const ctx = useMemo<Record<string, string>>(() => {
    if (!contrato) return {} as Record<string, string>;
    const out: Record<string, string> = {
      "contrato.numero": contrato.numero ?? `#${contrato.id.slice(0, 8)}`,
      "contrato.tipo": contrato.tipo,
      "contrato.status": contrato.status,
      "contrato.valor": formatBRL(contrato.valor),
      "contrato.data_inicio": fmtDate(contrato.data_inicio),
      "contrato.data_fim": fmtDate(contrato.data_fim),
      "contrato.comissao_percentual": contrato.comissao_percentual
        ? `${contrato.comissao_percentual}%`
        : "—",
      "contrato.comissao_valor": formatBRL(contrato.comissao_valor),
      "imovel.titulo": imovel?.titulo ?? "—",
      "imovel.codigo_interno": imovel?.codigo_interno ?? "—",
      "imovel.endereco": enderecoImovel,
      "tenant.nome": tenant?.nome ?? "—",
      "tenant.cnpj": tenant?.cnpj ?? "—",
      "tenant.creci": tenant?.creci_juridico ?? "—",
      "partes.vendedor": partesByPapel(partes, "vendedor"),
      "partes.comprador": partesByPapel(partes, "comprador"),
      "partes.locador": partesByPapel(partes, "locador"),
      "partes.locatario": partesByPapel(partes, "locatario"),
      "partes.fiador": partesByPapel(partes, "fiador"),
      "partes.testemunha": partesByPapel(partes, "testemunha"),
    };
    return out;
  }, [contrato, imovel, tenant, partes, enderecoImovel]);

  const template = templates.find((t) => t.id === templateId);
  const corpo = template ? interpolate(template.conteudo, ctx) : "";

  function imprimir() {
    if (!template) return toast.error("Selecione um modelo");
    window.print();
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!contrato)
    return <div className="p-8 text-sm text-muted-foreground">Contrato não encontrado.</div>;

  return (
    <div className="p-8">
      <div className="print:hidden">
        <Link
          to="/app/contratos/$id"
          params={{ id }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Imprimir contrato</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione um modelo, revise e imprima ou salve em PDF.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase text-muted-foreground">Modelo</Label>
              <select
                className="h-10 w-72 rounded-md border border-input bg-background px-3 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">— Selecione —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={imprimir}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
          </div>
        </header>

        {templates.length === 0 && (
          <div className="mb-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum modelo cadastrado.{" "}
            <Link to="/app/contratos/modelos" className="text-primary underline">
              Criar modelo
            </Link>
          </div>
        )}
      </div>

      {template && (
        <article
          className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-12 leading-relaxed text-foreground shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6"
          // Templates só podem ser editados por admins do tenant (RLS).
          dangerouslySetInnerHTML={{ __html: corpo }}
        />
      )}
    </div>
  );
}
