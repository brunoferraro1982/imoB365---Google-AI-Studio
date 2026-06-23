/**
 * imoB365 — /conta/mfa-setup
 *
 * Página de configuração de MFA (TOTP).
 * Usuário chega aqui quando mfa_required=TRUE e TOTP não está configurado.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/conta/mfa-setup")({
  component: MfaSetupPage,
});

function MfaSetupPage() {
  const [qrCode, setQrCode]     = useState<string | null>(null);
  const [secret, setSecret]     = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode]         = useState("");
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    async function enroll() {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "imoB365",
      });
      if (error) { toast.error("Erro ao iniciar configuração de MFA"); return; }
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    }
    void enroll();
  }, []);

  async function handleVerify() {
    if (!factorId) return;
    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      toast.success("MFA configurado com sucesso!");
      window.location.href = "/app/dashboard";
    } catch (err: unknown) {
      toast.error(`Código inválido: ${err instanceof Error ? err.message : "tente novamente"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Configurar autenticação em 2 fatores</h1>
          <p className="text-muted-foreground mt-2">
            Sua conta exige MFA. Escaneie o QR Code com Google Authenticator ou Authy.
          </p>
        </div>

        {qrCode && (
          <div className="flex flex-col items-center gap-4">
            <img src={qrCode} alt="QR Code MFA" className="w-48 h-48 border rounded-lg" />
            {secret && (
              <p className="text-xs text-muted-foreground break-all text-center">
                Chave manual: <code className="font-mono">{secret}</code>
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Código de verificação (6 dígitos)</label>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <Button
          className="w-full"
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading ? "Verificando..." : "Confirmar e ativar MFA"}
        </Button>
      </div>
    </div>
  );
}
