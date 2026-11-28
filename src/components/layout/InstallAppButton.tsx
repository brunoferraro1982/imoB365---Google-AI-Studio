import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/** Botão "Instalar app" (PWA). Só aparece quando o navegador oferece a instalação. */
export function InstallAppButton() {
  const { canInstall, install } = usePwaInstall();
  if (!canInstall) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      title="Instalar o imob365 neste dispositivo"
      onClick={async () => {
        const outcome = await install();
        if (outcome === "accepted") toast.success("imob365 instalado neste dispositivo");
      }}
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Instalar app</span>
    </Button>
  );
}
