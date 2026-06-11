import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";

export const Route = createFileRoute("/app/configuracoes/seguranca")({
  component: SegurancaPage,
});

type Factor = { id: string; status: string; friendly_name?: string | null; factor_type: string };

function SegurancaPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const { confirmDialog, ConfirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    setFactors((data?.all ?? []) as unknown as Factor[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function enroll() {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "App Authenticator",
    });
    setEnrolling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQr({ factorId: data.id, qr: (data as any).totp.qr_code, secret: (data as any).totp.secret });
  }

  async function verify() {
    if (!qr) return;
    setVerifying(true);
    const ch = await supabase.auth.mfa.challenge({ factorId: qr.factorId });
    if (ch.error) {
      setVerifying(false);
      return toast.error(ch.error.message);
    }
    const v = await supabase.auth.mfa.verify({
      factorId: qr.factorId,
      challengeId: ch.data.id,
      code,
    });
    setVerifying(false);
    if (v.error) return toast.error(v.error.message);
    toast.success("MFA ativado");
    setQr(null);
    setCode("");
    load();
  }

  async function unenroll(factorId: string) {
    if (!(await confirmDialog("Remover este fator de autenticação?"))) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return toast.error(error.message);
    toast.success("Fator removido");
    load();
  }

  return (
    <div className="max-w-3xl space-y-8">
      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold">Autenticação em dois fatores (MFA)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use um aplicativo autenticador (Google Authenticator, 1Password, Authy) para gerar um
              código de 6 dígitos a cada login.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : factors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fator cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {factors.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {f.friendly_name ?? f.factor_type.toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground">Status: {f.status}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => unenroll(f.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!qr && (
            <Button className="mt-4" onClick={enroll} disabled={enrolling}>
              <KeyRound className="mr-2 h-4 w-4" />{" "}
              {enrolling ? "Gerando…" : "Adicionar autenticador TOTP"}
            </Button>
          )}

          {qr && (
            <div className="mt-6 rounded-lg border p-4">
              <p className="text-sm">Escaneie o QR Code no seu app autenticador:</p>
              <img src={qr.qr} alt="QR MFA" className="mt-3 h-44 w-44" />
              <p className="mt-2 text-xs text-muted-foreground">
                Ou use o segredo: <code className="rounded bg-muted px-1">{qr.secret}</code>
              </p>
              <div className="mt-4 flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Código de 6 dígitos</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                  />
                </div>
                <Button onClick={verify} disabled={code.length !== 6 || verifying}>
                  {verifying ? "Verificando…" : "Confirmar"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQr(null);
                    setCode("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
      <ConfirmDialog />
    </div>
  );
}
