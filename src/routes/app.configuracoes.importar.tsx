import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/importar")({
  component: ImportarPage,
});

type EntityKey = "imoveis" | "leads";

const TEMPLATES: Record<EntityKey, string> = {
  imoveis:
    "titulo,tipo,finalidade,preco,quartos,banheiros,vagas,endereco_cidade,endereco_uf\nApartamento exemplo,apartamento,venda,450000,2,1,1,Curitiba,PR",
  leads:
    "nome,email,telefone,origem,mensagem\nJoão Silva,joao@example.com,41999990000,site,Tenho interesse no imóvel X",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    // simple CSV: comma split, no quoting inside fields
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `item-${Date.now()}`
  );
}

function ImportarPage() {
  const { tenantId, isAdmin, user } = useAuth();
  const [entity, setEntity] = useState<EntityKey>("imoveis");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  async function importar() {
    if (!tenantId) return;
    const rows = parseCSV(csv);
    if (rows.length === 0) {
      toast.error("CSV vazio ou inválido.");
      return;
    }
    setBusy(true);
    let ok = 0,
      fail = 0;
    const errors: string[] = [];

    if (entity === "imoveis") {
      const payload = rows.map((r) => ({
        tenant_id: tenantId,
        titulo: r.titulo,
        slug: slugify(r.titulo || ""),
        tipo: (r.tipo || "apartamento") as any,
        finalidade: (r.finalidade || "venda") as any,
        preco: Number(r.preco) || 0,
        quartos: r.quartos ? Number(r.quartos) : null,
        banheiros: r.banheiros ? Number(r.banheiros) : null,
        vagas: r.vagas ? Number(r.vagas) : null,
        endereco_cidade: r.endereco_cidade || null,
        endereco_uf: r.endereco_uf || null,
        created_by: user?.id ?? null,
      }));
      const { data, error } = await supabase.from("imoveis").insert(payload).select("id");
      if (error) {
        fail = rows.length;
        errors.push(error.message);
      } else ok = data?.length ?? 0;
    } else {
      const payload = rows.map((r) => ({
        tenant_id: tenantId,
        nome: r.nome,
        email: r.email || null,
        telefone: r.telefone || null,
        origem: (r.origem || "site") as any,
        mensagem: r.mensagem || null,
      }));
      const { data, error } = await supabase.from("leads").insert(payload).select("id");
      if (error) {
        fail = rows.length;
        errors.push(error.message);
      } else ok = data?.length ?? 0;
    }

    setBusy(false);
    setResult({ ok, fail, errors });
    if (ok > 0) toast.success(`${ok} registro(s) importado(s)`);
  }

  if (!isAdmin) return <div className="text-sm text-muted-foreground">Apenas administradores.</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Importar via CSV</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole o conteúdo de um arquivo CSV (separado por vírgulas, sem aspas internas).
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Entidade</Label>
            <Select
              value={entity}
              onValueChange={(v: EntityKey) => {
                setEntity(v);
                setCsv("");
                setResult(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imoveis">Imóveis</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" type="button" onClick={() => setCsv(TEMPLATES[entity])}>
              <FileText className="mr-2 h-4 w-4" /> Carregar modelo
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Label>CSV</Label>
          <Textarea
            rows={10}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={importar} disabled={busy || !csv.trim()}>
            {busy ? "Importando…" : "Importar"}
          </Button>
        </div>

        {result && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {result.ok} importados
            </div>
            {result.fail > 0 && (
              <div className="mt-2 flex items-start gap-2 text-rose-600">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <div>{result.fail} falharam</div>
                  {result.errors.map((e, i) => (
                    <div key={i} className="mt-1 text-xs">
                      {e}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
