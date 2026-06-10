import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/visita-checkin/$token")({
  component: VisitaCheckin,
});

function VisitaCheckin() {
  const { token } = Route.useParams();
  const [step, setStep] = useState<"loading" | "checkin" | "nps" | "done">("loading");
  const [imovel, setImovel] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    setStep("checkin");
  }, []);

  async function checkin() {
    const { data, error } = await (supabase.rpc as any)("public_visita_checkin", { _token: token });
    if (error) return toast.error(error.message);
    setImovel((data as any)?.imovel ?? "");
    setStep("nps");
  }

  async function enviarNps() {
    if (score === null) return toast.error("Selecione uma nota");
    const { error } = await (supabase.rpc as any)("public_visita_nps", {
      _token: token,
      _score: score,
      _comentario: comentario,
    });
    if (error) return toast.error(error.message);
    setStep("done");
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-md rounded-xl border bg-card p-6 shadow-sm">
        {step === "checkin" && (
          <>
            <h1 className="mb-2 text-xl font-semibold">Confirmar visita</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Toque abaixo para registrar sua presença na visita.
            </p>
            <Button className="w-full" onClick={checkin}>
              Confirmar presença
            </Button>
          </>
        )}
        {step === "nps" && (
          <>
            <h1 className="mb-2 text-xl font-semibold">Como foi a visita?</h1>
            {imovel && <p className="mb-4 text-sm text-muted-foreground">{imovel}</p>}
            <p className="mb-3 text-sm">
              De 0 a 10, qual a chance de você recomendar nossa imobiliária?
            </p>
            <div className="mb-4 grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setScore(i)}
                  className={`rounded border py-2 text-sm font-medium ${score === i ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
                >
                  {i}
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              placeholder="Conte-nos como foi (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mb-3"
            />
            <Button className="w-full" onClick={enviarNps}>
              Enviar avaliação
            </Button>
          </>
        )}
        {step === "done" && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-primary" />
            <h2 className="text-lg font-semibold">Obrigado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sua opinião foi registrada.</p>
          </div>
        )}
      </div>
    </main>
  );
}
