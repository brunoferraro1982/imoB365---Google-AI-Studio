import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import {
  IdCard,
  ExternalLink,
  Copy,
  Check,
  Download,
  FileText,
  Upload,
  Trash2,
  UserPlus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { baixarVCard } from "@/lib/vcard";
import { slugify } from "@/lib/format";
import { listTenantMembers } from "@/lib/team.functions";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/cartao-virtual")({
  head: () => ({ meta: [{ title: "Cartão Virtual — imob365" }] }),
  component: CartaoVirtualPage,
});

type Corretor = {
  id: string;
  nome: string;
  slug: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cargo: string | null;
  creci: string | null;
  creci_uf: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  site: string | null;
  cirp_storage_path: string | null;
  cirp_enviado_em: string | null;
  user_id: string | null;
};

type Membro = { user_id: string; nome: string | null; email: string | null };

const BUCKET = "corretor-documentos";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DIM = 1920;

// Mesmo espírito de comprimirImagem() em DocumentoUpload.tsx — cópia local
// pequena, o padrão já estabelecido no projeto é duplicar em vez de extrair
// um util compartilhado pra isso (ver watermark.ts).
async function comprimirSePossivel(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

function CartaoVirtualPage() {
  const { tenantId, user, isAdmin, profile } = useAuth();
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const listMembers = useServerFn(listTenantMembers);

  const [membros, setMembros] = useState<Membro[]>([]);
  const [corretoresPorUser, setCorretoresPorUser] = useState<
    Record<string, { id: string; nome: string }>
  >({});
  const [meuCorretorId, setMeuCorretorId] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [corretor, setCorretor] = useState<Corretor | null>(null);
  const [tenantNome, setTenantNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cirpUrl, setCirpUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Cadastro direto (self-service ou admin criando pra um membro da equipe)
  const [criandoPara, setCriandoPara] = useState<{
    userId: string;
    nome: string;
    email: string;
  } | null>(null);
  const [novoTelefone, setNovoTelefone] = useState("");
  const [criando, setCriando] = useState(false);

  const [form, setForm] = useState({
    telefone: "",
    whatsapp: "",
    email: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    site: "",
  });

  async function carregarListaBase() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: t }, { data: cors }] = await Promise.all([
      supabase.from("tenants").select("nome").eq("id", tenantId).maybeSingle(),
      (supabase as any).from("corretores").select("id,nome,user_id").eq("tenant_id", tenantId),
    ]);
    setTenantNome(t?.nome ?? null);
    const corretoresList = (cors as { id: string; nome: string; user_id: string | null }[]) ?? [];
    const porUser: Record<string, { id: string; nome: string }> = {};
    corretoresList.forEach((c) => {
      if (c.user_id) porUser[c.user_id] = { id: c.id, nome: c.nome };
    });
    setCorretoresPorUser(porUser);
    const proprio = corretoresList.find((c) => c.user_id === user?.id);
    setMeuCorretorId(proprio?.id ?? null);

    if (isAdmin) {
      try {
        const res = await listMembers({ data: { tenantId } });
        setMembros((res?.members as Membro[]) ?? []);
      } catch {
        setMembros([]);
      }
    }

    if (proprio) {
      setSelecionadoId(proprio.id);
    } else {
      setSelecionadoId(null);
      setCorretor(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregarListaBase();
  }, [tenantId, user?.id, isAdmin]);

  async function carregarCorretor(id: string) {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("corretores")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      setCorretor(data as Corretor);
      setForm({
        telefone: data.telefone ?? "",
        whatsapp: data.whatsapp ?? "",
        email: data.email ?? "",
        instagram: data.instagram ?? "",
        facebook: data.facebook ?? "",
        linkedin: data.linkedin ?? "",
        site: data.site ?? "",
      });
      if (data.cirp_storage_path) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(data.cirp_storage_path, 15 * 60);
        setCirpUrl(signed?.signedUrl ?? null);
      } else {
        setCirpUrl(null);
      }
      const publicUrl = `${window.location.origin}/corretor/${data.slug}`;
      QRCode.toDataURL(publicUrl, { width: 320, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selecionadoId) carregarCorretor(selecionadoId);
  }, [selecionadoId]);

  async function salvar() {
    if (!corretor) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("corretores")
      .update({
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        linkedin: form.linkedin || null,
        site: form.site || null,
      })
      .eq("id", corretor.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cartão virtual atualizado");
  }

  async function handleUploadCirp(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !corretor || !tenantId) return;
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      return;
    }
    setUploading(true);
    try {
      const upload = await comprimirSePossivel(file);
      const ext = upload.name.split(".").pop() || "jpg";
      const path = `${tenantId}/${corretor.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, upload, { cacheControl: "3600", contentType: upload.type });
      if (upErr) {
        toast.error("Erro ao enviar: " + upErr.message);
        return;
      }
      const anterior = corretor.cirp_storage_path;
      const { error: updErr } = await (supabase as any)
        .from("corretores")
        .update({ cirp_storage_path: path, cirp_enviado_em: new Date().toISOString() })
        .eq("id", corretor.id);
      if (updErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        toast.error("Erro ao salvar: " + updErr.message);
        return;
      }
      if (anterior) await supabase.storage.from(BUCKET).remove([anterior]);
      toast.success("CIRP enviado com sucesso");
      carregarCorretor(corretor.id);
    } finally {
      setUploading(false);
    }
  }

  async function removerCirp() {
    if (!corretor?.cirp_storage_path) return;
    if (!(await confirmDialog("Remover o CIRP enviado?"))) return;
    const path = corretor.cirp_storage_path;
    await (supabase as any)
      .from("corretores")
      .update({ cirp_storage_path: null, cirp_enviado_em: null })
      .eq("id", corretor.id);
    await supabase.storage.from(BUCKET).remove([path]);
    toast.success("CIRP removido");
    carregarCorretor(corretor.id);
  }

  function copiarLink() {
    if (!corretor) return;
    navigator.clipboard.writeText(`${window.location.origin}/corretor/${corretor.slug}`);
    setLinkCopiado(true);
    toast.success("Link copiado");
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  function baixarQr() {
    if (!qrDataUrl || !corretor) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-code-${corretor.slug}.png`;
    a.click();
  }

  async function abrirCriacao(userId: string, nomeSugerido: string, emailSugerido: string) {
    setCriandoPara({ userId, nome: nomeSugerido, email: emailSugerido });
    let telefonePre = "";
    if (userId === user?.id) {
      const { data } = await supabase
        .from("profiles")
        .select("telefone")
        .eq("id", userId)
        .maybeSingle();
      telefonePre = (data as any)?.telefone ?? "";
    }
    setNovoTelefone(telefonePre);
  }

  async function confirmarCriacao() {
    if (!criandoPara || !tenantId) return;
    if (!criandoPara.nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    setCriando(true);
    const slugBase = slugify(criandoPara.nome) || `corretor-${Date.now()}`;
    let slug = slugBase;
    let novoId: string | null = null;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const { data, error } = await (supabase as any)
        .from("corretores")
        .insert({
          tenant_id: tenantId,
          user_id: criandoPara.userId,
          nome: criandoPara.nome.trim(),
          email: criandoPara.email || null,
          telefone: novoTelefone || null,
          slug,
          ativo: true,
          publico: true,
        })
        .select("id")
        .single();
      if (!error) {
        novoId = data.id;
        break;
      }
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        slug = `${slugBase}-${tentativa + 2}`;
        continue;
      }
      toast.error(error.message);
      setCriando(false);
      return;
    }
    setCriando(false);
    if (!novoId) {
      toast.error("Não foi possível criar o cartão. Tente novamente.");
      return;
    }
    toast.success("Cartão virtual criado");
    setCriandoPara(null);
    await carregarListaBase();
    setSelecionadoId(novoId);
  }

  if (loading && !corretor && !criandoPara) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  if (criandoPara) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <IdCard className="h-7 w-7 text-primary" />
            Criar Cartão Virtual
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirme os dados abaixo — já preenchemos com o que já sabemos da conta.
          </p>
        </header>
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nome completo *
            </Label>
            <Input
              value={criandoPara.nome}
              onChange={(e) => setCriandoPara((c) => (c ? { ...c, nome: e.target.value } : c))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              E-mail
            </Label>
            <Input
              type="email"
              value={criandoPara.email}
              onChange={(e) => setCriandoPara((c) => (c ? { ...c, email: e.target.value } : c))}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Telefone
            </Label>
            <Input
              value={novoTelefone}
              onChange={(e) => setNovoTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCriandoPara(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarCriacao} disabled={criando}>
              {criando ? "Criando…" : "Criar Cartão Virtual"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin && !meuCorretorId && !corretor) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <IdCard className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 text-xl font-bold">Cartão Virtual</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você ainda não tem um cartão virtual. Crie o seu agora — é rápido, já aproveitamos os
            dados da sua conta.
          </p>
          <Button
            className="mt-4"
            onClick={() => abrirCriacao(user!.id, profile?.nome ?? "", user?.email ?? "")}
          >
            <UserPlus className="mr-2 h-4 w-4" /> Criar meu Cartão Virtual
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <IdCard className="h-7 w-7 text-primary" />
          Cartão Virtual
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados de contato, redes sociais e o link público que podem ser compartilhados com
          clientes.
        </p>
      </header>

      {isAdmin && (
        <section className="mb-6 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Equipe ({membros.length})
          </h2>
          <ul className="divide-y divide-border">
            {membros.map((m) => {
              const card = corretoresPorUser[m.user_id];
              const isSelf = m.user_id === user?.id;
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {m.nome ?? m.email ?? "—"}
                      {isSelf ? " (você)" : ""}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                  </div>
                  {card ? (
                    <Button
                      size="sm"
                      variant={selecionadoId === card.id ? "default" : "outline"}
                      onClick={() => setSelecionadoId(card.id)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar cartão
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirCriacao(m.user_id, m.nome ?? "", m.email ?? "")}
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Criar cartão
                    </Button>
                  )}
                </li>
              );
            })}
            {membros.length === 0 && (
              <li className="py-2.5 text-sm text-muted-foreground">
                Nenhum membro na equipe ainda.
              </li>
            )}
          </ul>
        </section>
      )}

      {corretor && (
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Compartilhar</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" asChild>
                <a href={`/corretor/${corretor.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Ver cartão público
                </a>
              </Button>
              <Button variant="outline" onClick={copiarLink}>
                {linkCopiado ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copiar link
              </Button>
              <Button variant="outline" onClick={baixarQr} disabled={!qrDataUrl}>
                <Download className="mr-2 h-4 w-4" /> Baixar QR Code
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  baixarVCard(
                    {
                      nome: corretor.nome,
                      telefone: corretor.telefone,
                      whatsapp: corretor.whatsapp,
                      email: corretor.email,
                      cargo: corretor.cargo,
                      site: corretor.site,
                      creci: corretor.creci,
                      creci_uf: corretor.creci_uf,
                    },
                    tenantNome,
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" /> Baixar contato (.vcf)
              </Button>
            </div>
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code do cartão público"
                className="mt-4 h-40 w-40 rounded-lg border border-border"
              />
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Contato</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Telefone
                </Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  WhatsApp
                </Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Redes sociais</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Instagram
                </Label>
                <Input
                  value={form.instagram}
                  onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                  placeholder="https://instagram.com/seuusuario"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Facebook
                </Label>
                <Input
                  value={form.facebook}
                  onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))}
                  placeholder="https://facebook.com/suapagina"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  LinkedIn
                </Label>
                <Input
                  value={form.linkedin}
                  onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/in/seuusuario"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Site pessoal
                </Label>
                <Input
                  value={form.site}
                  onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))}
                  placeholder="https://seusite.com.br"
                />
              </div>
            </div>
            <Button className="mt-4" onClick={salvar} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-1 text-lg font-semibold">CIRP (carteira do CRECI)</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Documento pessoal, visível só pra você e pra administração da imobiliária — nunca
              aparece na página pública.
            </p>
            {corretor.cirp_storage_path ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>
                    Enviado em{" "}
                    {corretor.cirp_enviado_em
                      ? new Date(corretor.cirp_enviado_em).toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {cirpUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={cirpUrl} target="_blank" rel="noreferrer">
                        Ver
                      </a>
                    </Button>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    {uploading ? "Enviando…" : "Substituir"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleUploadCirp}
                      disabled={uploading}
                    />
                  </label>
                  <Button size="sm" variant="ghost" onClick={removerCirp} className="text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="h-6 w-6" />
                {uploading ? "Enviando…" : "Clique pra enviar uma foto ou PDF do CIRP"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleUploadCirp}
                  disabled={uploading}
                />
              </label>
            )}
          </section>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
