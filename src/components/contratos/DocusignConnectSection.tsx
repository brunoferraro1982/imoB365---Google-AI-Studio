import { useEffect, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, CheckCircle2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getDocusignConnectionStatus,
  getDocusignAuthorizeUrl,
  salvarDocusignAppCredentials,
  removerDocusignAppCredentials,
  disconnectDocusign,
} from "@/lib/docusignOAuth.functions";

const DOCUSIGN_ERROR_LABEL: Record<string, string> = {
  parametros_ausentes: "O DocuSign não retornou os parâmetros esperados.",
  state_invalido: "A conexão expirou ou é inválida — tente novamente.",
  integracao_nao_configurada: "Configure sua Integration Key antes de conectar.",
  token_exchange_falhou:
    "O DocuSign recusou a autorização — confira se a Integration Key/Secret Key estão corretos e se a conexão já passou pelo Go-Live.",
  userinfo_falhou: "Não foi possível identificar sua conta DocuSign conectada.",
  erro_ao_salvar: "Falha ao salvar a conexão. Tente novamente.",
};

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

// Primeira integração real de assinatura eletrônica deste CLM — DocuSign
// tem API OAuth 2.0 real (confirmado contra a documentação oficial),
// mesmo padrão BYO já usado pra Meta/Canva/Mercado Pago Marketplace.
export function DocusignConnectSection() {
  const search = useSearch({ strict: false }) as {
    docusign_connected?: string;
    docusign_error?: string;
  };
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const fetchStatus = useServerFn(getDocusignConnectionStatus);
  const fetchAuthorizeUrl = useServerFn(getDocusignAuthorizeUrl);
  const salvarCredenciais = useServerFn(salvarDocusignAppCredentials);
  const removerCredenciais = useServerFn(removerDocusignAppCredentials);
  const desconectar = useServerFn(disconnectDocusign);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["docusign-connection-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (search.docusign_connected) {
      toast.success("Conta DocuSign conectada com sucesso!");
      refetch();
    } else if (search.docusign_error) {
      toast.error(
        DOCUSIGN_ERROR_LABEL[search.docusign_error] ?? "Não foi possível conectar ao DocuSign.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://portal.imob365.com.br";
  const redirectUri = `${origin}/api/public/docusign/oauth/callback`;

  async function onSalvar() {
    if (!clientId || !clientSecret) {
      toast.error("Preencha a Integration Key e a Secret Key.");
      return;
    }
    setSalvando(true);
    try {
      await salvarCredenciais({ data: { clientId, clientSecret } });
      toast.success("App do DocuSign salvo. Agora clique em Conectar DocuSign.");
      setClientId("");
      setClientSecret("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function onConectar() {
    setConectando(true);
    try {
      const { url } = await fetchAuthorizeUrl();
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão");
      setConectando(false);
    }
  }

  async function onDesconectar() {
    setDesconectando(true);
    try {
      await desconectar();
      toast.success("Conta DocuSign desconectada");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desconectar");
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover");
    } finally {
      setRemovendo(false);
    }
  }

  if (isLoading) return null;

  return (
    <section className="mb-6 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-card to-card p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">DocuSign</h2>
        <Badge variant="outline" className="text-[10px] uppercase">
          OAuth completo
        </Badge>
        {data?.connected && (
          <Badge className="gap-1 bg-emerald-600 text-[10px] hover:bg-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Conectado
          </Badge>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Conecte a própria conta DocuSign da imobiliária pra enviar contratos direto pela API, com a
        confirmação de assinatura chegando automaticamente por webhook — sem precisar configurar
        nada manualmente no painel do DocuSign.
      </p>

      {!data?.appConfigured ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p className="mb-2 font-medium">Passo a passo (leva de 10 a 20 minutos)</p>
            <ol className="space-y-3 text-xs text-muted-foreground">
              <li>
                <strong>1.</strong> Faça login em{" "}
                <a
                  href="https://admin.docusign.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  admin.docusign.com <ExternalLink className="inline h-3 w-3" />
                </a>{" "}
                (é preciso ter uma conta DocuSign — grátis pra testar, paga pra uso real) →{" "}
                <strong>Integrações → Apps e Chaves</strong> →{" "}
                <strong>"Adicionar App e Chave de Integração"</strong> → dê o nome que quiser.
              </li>
              <li>
                <strong>2.</strong> Em "URI de redirecionamento do OAuth", cole o valor abaixo:
                <div className="mt-1.5">
                  <CopyField value={redirectUri} />
                </div>
              </li>
              <li>
                <strong>3.</strong> Gere uma "Secret Key" pra essa Integration Key e copie os dois
                valores (Integration Key + Secret Key) — a Secret Key só aparece uma vez.
              </li>
              <li>
                <strong>4.</strong> Cole os dois valores abaixo e clique em "Salvar".
              </li>
              <li>
                <strong>5. Importante:</strong> diferente da Meta/Canva, o DocuSign exige uma etapa
                de <strong>Go-Live</strong> (promoção da chave do ambiente de testes pro de
                produção) mesmo quando ela só vai ser usada com a sua própria conta — geralmente
                rápido (minutos a poucos dias). O DocuSign avisa quando isso é necessário; se
                aparecer, siga as instruções deles antes de conectar aqui.
              </li>
            </ol>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="space-y-1.5">
              <Label>Integration Key (Client ID)</Label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Secret Key</Label>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            <Button onClick={onSalvar} disabled={salvando} className="w-full">
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">App configurado</span>
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
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-sm">
                  <p className="font-medium">Conta DocuSign conectada</p>
                  {data.accountName && (
                    <p className="text-muted-foreground">Conta: {data.accountName}</p>
                  )}
                </div>
              </div>
              <Button variant="outline" onClick={onDesconectar} disabled={desconectando}>
                {desconectando ? "Desconectando…" : "Desconectar conta"}
              </Button>
            </div>
          ) : (
            <Button onClick={onConectar} disabled={conectando}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {conectando ? "Redirecionando…" : "Conectar DocuSign"}
            </Button>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Precisa de ajuda?{" "}
        <Link to="/ajuda/docusign" target="_blank" className="text-primary underline">
          Ver guia completo, passo a passo
        </Link>
        .
      </p>
    </section>
  );
}
