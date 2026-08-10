import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Upload, Trash2, ExternalLink, History } from "lucide-react";
import { comprimirImagem } from "@/lib/imageCompress";

// Primeira gestão documental real do contrato — hoje nem bucket, nem tabela,
// nem compressão existiam (arquivo_path em contratos é coluna morta).
const CATEGORIAS = [
  { value: "rg", label: "RG" },
  { value: "cpf", label: "CPF" },
  { value: "cnh", label: "CNH" },
  { value: "comprovante", label: "Comprovante" },
  { value: "escritura", label: "Escritura" },
  { value: "matricula", label: "Matrícula" },
  { value: "iptu", label: "IPTU" },
  { value: "laudo", label: "Laudo" },
  { value: "vistoria", label: "Vistoria" },
  { value: "foto", label: "Foto" },
  { value: "video", label: "Vídeo" },
  { value: "procuracao", label: "Procuração" },
  { value: "recibo", label: "Recibo" },
  { value: "anexo", label: "Anexo" },
];
const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type Documento = {
  id: string;
  categoria: string;
  storage_path: string;
  nome_original: string;
  tamanho_bytes: number | null;
  versao: number;
  documento_anterior_id: string | null;
  created_at: string;
};

// Resize/compressão de imagem (comprimirImagem) vive em @/lib/imageCompress —
// mesma lógica reaproveitada pelos uploads de foto de imóvel/corretor.

export function DocumentoUpload({ contratoId }: { contratoId: string }) {
  const { tenantId } = useAuth();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState("anexo");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versaoInputRef = useRef<HTMLInputElement>(null);
  const [documentoBaseId, setDocumentoBaseId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("contrato_documentos")
      .select(
        "id,categoria,storage_path,nome_original,tamanho_bytes,versao,documento_anterior_id,created_at",
      )
      .eq("contrato_id", contratoId)
      .order("created_at", { ascending: false });
    setDocumentos((data ?? []) as Documento[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [contratoId]);

  async function processarArquivo(file: File): Promise<File> {
    if (file.size > MAX_BYTES) {
      throw new Error(`Arquivo maior que 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    }
    if (file.type.startsWith("image/") && file.type !== "image/webp") {
      const comprimido = await comprimirImagem(file);
      if (comprimido.size > MAX_BYTES) {
        throw new Error("Arquivo continua maior que 10MB mesmo após compressão");
      }
      return comprimido;
    }
    return file;
  }

  async function fazerUpload(file: File, categoriaEscolhida: string, anteriorId: string | null) {
    if (!tenantId) return;
    setUploading(true);
    try {
      const processado = await processarArquivo(file);
      const ext = processado.name.split(".").pop() || "bin";
      const path = `${tenantId}/${contratoId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("contrato-documentos")
        .upload(path, processado, { cacheControl: "3600", contentType: processado.type });
      if (uploadError) throw uploadError;

      const anterior = anteriorId ? documentos.find((d) => d.id === anteriorId) : null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: insertError } = await (supabase as any).from("contrato_documentos").insert({
        tenant_id: tenantId,
        contrato_id: contratoId,
        categoria: categoriaEscolhida,
        storage_path: path,
        nome_original: file.name,
        tamanho_bytes: processado.size,
        versao: anterior ? anterior.versao + 1 : 1,
        documento_anterior_id: anteriorId,
        uploaded_by: user?.id ?? null,
      });
      if (insertError) throw insertError;
      toast.success(anteriorId ? "Nova versão enviada" : "Documento enviado");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  }

  function onSelectNovoArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    fazerUpload(file, categoria, null);
  }

  function onSelectNovaVersao(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !documentoBaseId) return;
    const base = documentos.find((d) => d.id === documentoBaseId);
    if (!base) return;
    fazerUpload(file, base.categoria, documentoBaseId);
  }

  async function visualizar(doc: Documento) {
    const { data, error } = await supabase.storage
      .from("contrato-documentos")
      .createSignedUrl(doc.storage_path, 15 * 60);
    if (error || !data?.signedUrl) return toast.error("Não foi possível gerar o link do documento");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remover(doc: Documento) {
    if (!confirm(`Remover "${doc.nome_original}"?`)) return;
    await supabase.storage.from("contrato-documentos").remove([doc.storage_path]);
    const { error } = await (supabase as any).from("contrato_documentos").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    load();
  }

  if (loading) return null;

  const grupos = documentos.reduce<Record<string, Documento[]>>((acc, d) => {
    (acc[d.categoria] ||= []).push(d);
    return acc;
  }, {});

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold">
        <FileText className="h-4 w-4" /> Documentos do contrato
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        RG, CPF, comprovantes, escritura, laudos e demais anexos — visível apenas para membros do
        tenant. Fotos são comprimidas automaticamente antes do envio.
      </p>

      {documentos.length > 0 && (
        <div className="mb-4 space-y-3">
          {Object.entries(grupos).map(([cat, lista]) => (
            <div key={cat}>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORIA_LABEL[cat] ?? cat}
              </h4>
              <ul className="space-y-1">
                {lista.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm">{doc.nome_original}</span>
                        {doc.versao > 1 && <Badge variant="secondary">v{doc.versao}</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {doc.tamanho_bytes != null &&
                          `${(doc.tamanho_bytes / 1024).toFixed(0)} KB · `}
                        {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => visualizar(doc)}
                        title="Ver"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Nova versão"
                        onClick={() => {
                          setDocumentoBaseId(doc.id);
                          versaoInputRef.current?.click();
                        }}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remover(doc)}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-1 h-4 w-4" />
          {uploading ? "Enviando…" : "Enviar arquivo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onSelectNovoArquivo}
          accept="image/*,application/pdf"
        />
        <input
          ref={versaoInputRef}
          type="file"
          className="hidden"
          onChange={onSelectNovaVersao}
          accept="image/*,application/pdf"
        />
        <span className="text-[11px] text-muted-foreground">Máx. 10MB por arquivo</span>
      </div>
    </section>
  );
}
