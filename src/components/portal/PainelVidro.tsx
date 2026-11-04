import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

// Painel "Liquid Glass" aberto por cima da página atual (não é nova janela):
// o overlay só desfoca o que está atrás e o conteúdo é uma placa de vidro
// fosco. Esc, clique fora e o "×" fecham; o foco fica preso no painel (Radix).
export function PainelVidro({
  aberto,
  onAbertoChange,
  titulo,
  subtitulo,
  icone,
  children,
}: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  titulo: string;
  subtitulo?: string;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={onAbertoChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0f1e3a]/15 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="hero-brand glass-fosco fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:bg-[#0f1e3a]/80">
          <div className="flex items-start gap-3 border-b border-white/60 px-5 py-4 dark:border-white/10 md:px-6">
            {icone && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70 shadow-sm dark:bg-white/10">
                {icone}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-lg font-extrabold leading-tight tracking-tight text-foreground md:text-xl">
                {titulo}
              </DialogPrimitive.Title>
              {subtitulo ? (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                  {subtitulo}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {titulo}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/70 text-muted-foreground transition hover:bg-white hover:text-foreground dark:bg-white/10 dark:hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
