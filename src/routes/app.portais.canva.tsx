import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Palette, CheckCircle2, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getCanvaConnectionStatus,
  getCanvaAuthorizeUrl,
  salvarCanvaAppCredentials,
  removerCanvaAppCredentials,
  disconnectCanva,
} from "@/lib/canvaOAuth.functions";

const CANVA_ERROR_LABEL: Record<string, string> = {
  parametros_ausentes: "A Canva não retornou os parâmetros esperados.",
  state_invalido: "A conexão expirou ou é inválida — tente novamente.",
  integracao_nao_configurada: "Configure seu App da Canva antes de conectar.",
  token_exchange_falhou:
    "A Canva recusou a autorização — confira se o Client ID/Secret estão corretos.",
  erro_ao_salvar: "Falha ao salvar a conexão. Tente novamente.",
};

export const Route = createFileRoute("/app/portais/canva")({
  head: () => ({ meta: [{ title: "Conectar Canva — imob365" }] }),
  component: CanvaConexaoPage,
});

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
        {value}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copiado");
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Passo a passo pensado pra quem não é técnico — a mesma pessoa que já
// passou pelo wizard do Facebook/Instagram (app.portais.meta.tsx)
// reconhece o formato. Cada tenant cria a PRÓPRIA integração Canva
// ("Privada" — não passa por revisão da Canva, funciona na hora) e conecta
// a própria conta pessoal/Pro, nunca uma conta Canva operada pelo imob365.
function CanvaConexaoPage() {
  const search = useSearch({ strict: false }) as { canva_connected?: string; canva_error?: string };
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const fetchStatus = useServerFn(getCanvaConnectionStatus);
  const fetchAuthorizeUrl = useServerFn(getCanvaAuthorizeUrl);
  const salvarCredenciais = useServerFn(salvarCanvaAppCredentials);
  const removerCredenciais = useServerFn(removerCanvaAppCredentials);
  const desconectar = useServerFn(disconnectCanva);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["canva-connection-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (search.canva_connected) {
      toast.success("Conta Canva conectada com sucesso!");
      refetch();
    } else if (search.canva_error) {
      toast.error(CANVA_ERROR_LABEL[search.canva_error] ?? "Não foi possível conectar à Canva.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://portal.imob365.com.br";
  const redirectUri = `${origin}/api/public/canva/oauth/callback`;
  const returnUrl = `${origin}/app/imoveis/canva-retorno`;

  async function onSalvar() {
    if (!clientId || !clientSecret) {
      toast.error("Preencha o Client ID e o Client Secret.");
      return;
    }
    setSalvando(true);
    try {
      await salvarCredenciais({ data: { clientId, clientSecret } });
      toast.success("App da Canva salvo. Agora clique em Conectar Canva.");
      setClientId("");
      setClientSecret("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function onConectar() {
    setConectando(true);
    try {
      const { url } = await fetchAuthorizeUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a conexão");
      setConectando(false);
    }
  }

  async function onDesconectar() {
    setDesconectando(true);
    try {
      await desconectar();
      toast.success("Conta Canva desconectada");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível desconectar");
    } finally {
      setDesconectando(false);
    }
  }

  async function onRemoverApp() {
    if (!confirm("Isso apaga o App configurado e a conexão com a conta. Tem certeza?")) return;
    setRemovendo(true);
    try {
      await removerCredenciais();
      toast.success("App removido. Você pode configurar um novo a qualquer momento.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link
        to="/app/portais"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Palette className="h-7 w-7 text-primary" />
          Conectar Canva
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conectando sua própria conta Canva, você passa a poder abrir a imagem de qualquer post ou
          story de imóvel no editor de verdade da Canva pra personalizar antes de publicar.
        </p>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-6">
          {!data?.appConfigured && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-3 text-base font-semibold">Passo a passo (leva uns 10 minutos)</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Cada corretor/imobiliária cria o próprio "aplicativo" gratuito na Canva — é rápido e
                não exige nenhuma aprovação da Canva, porque a integração é "Privada" (só pra sua
                própria conta).
              </p>
              <ol className="space-y-4 text-sm">
                <li>
                  <strong>1. Conta na Canva.</strong> Se ainda não tiver, crie uma conta grátis em{" "}
                  <a
                    href="https://www.canva.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    canva.com <ExternalLink className="inline h-3 w-3" />
                  </a>
                  .
                </li>
                <li>
                  <strong>2. Criar a integração.</strong> Acesse{" "}
                  <a
                    href="https://www.canva.com/developers/integrations/connect-api"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    canva.com/developers <ExternalLink className="inline h-3 w-3" />
                  </a>{" "}
                  → "Criar uma integração" → tipo <strong>"Privada"</strong> (não "Pública" — a
                  Privada não passa por revisão da Canva e funciona na hora) → dê o nome que quiser
                  (ex.: "Corretor João — imob365").
                </li>
                <li>
                  <strong>3. Configurar autenticação (Redirect URI).</strong> Na aba "Autenticação"
                  da integração, cole a URL abaixo no campo de URI de redirecionamento:
                  <div className="mt-2">
                    <CopyField value={redirectUri} />
                  </div>
                </li>
                <li>
                  <strong>4. Configurar permissões (escopos).</strong> Ainda na integração, marque
                  as permissões: <code className="text-xs">asset:read</code>,{" "}
                  <code className="text-xs">asset:write</code>,{" "}
                  <code className="text-xs">design:content:read</code> e{" "}
                  <code className="text-xs">design:content:write</code>.
                </li>
                <li>
                  <strong>5. Configurar a Navegação de retorno (obrigatório).</strong> Na aba
                  "Return navigation", ative a opção e cole a URL abaixo — é o que traz você de
                  volta pra imob365 depois de editar e clicar em "Voltar" dentro da própria Canva:
                  <div className="mt-2">
                    <CopyField value={returnUrl} />
                  </div>
                </li>
                <li>
                  <strong>6. Copiar as credenciais.</strong> Na aba "Configurações", copie o{" "}
                  <strong>Client ID</strong> e o <strong>Client Secret</strong> e cole os dois
                  campos abaixo.
                </li>
              </ol>
            </section>
          )}

          {!data?.appConfigured ? (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-3 text-base font-semibold">Seu App da Canva</h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Client ID</Label>
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="OC-..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Client Secret</Label>
                  <Input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••"
                  />
                </div>
                <Button onClick={onSalvar} disabled={salvando} className="w-full">
                  {salvando ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Seu App da Canva</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRemoverApp}
                  disabled={removendo}
                  className="text-red-600"
                >
                  {removendo ? "Removendo…" : "Remover App configurado"}
                </Button>
              </div>

              {data?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="text-sm">
                      <p className="font-medium">Conta Canva conectada</p>
                      <p className="text-muted-foreground">
                        Desde{" "}
                        {data.connectedAt
                          ? new Date(data.connectedAt).toLocaleDateString("pt-BR")
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={onDesconectar} disabled={desconectando}>
                    {desconectando ? "Desconectando…" : "Desconectar conta"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    App configurado! Agora clique abaixo pra conectar a sua conta Canva.
                  </p>
                  <Button onClick={onConectar} disabled={conectando}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {conectando ? "Redirecionando…" : "Conectar Canva"}
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
