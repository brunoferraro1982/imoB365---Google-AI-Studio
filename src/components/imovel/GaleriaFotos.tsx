import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

export type GaleriaFoto = { url: string; alt?: string };

export function GaleriaFotos({ fotos, tituloAlt }: { fotos: GaleriaFoto[]; tituloAlt: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (fotos.length === 0) return null;

  const capa = fotos[0];
  const thumbs = fotos.slice(1, 5);
  const restantes = fotos.length - 5;

  return (
    <>
      <div className="mb-8 grid gap-2 overflow-hidden rounded-xl md:grid-cols-4 md:grid-rows-2">
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          className="block h-72 w-full md:col-span-2 md:row-span-2 md:h-full"
        >
          <img src={capa.url} alt={capa.alt || tituloAlt} className="h-full w-full object-cover" />
        </button>
        {thumbs.map((f, i) => {
          const isLast = i === thumbs.length - 1;
          return (
            <button
              type="button"
              key={f.url + i}
              onClick={() => setOpenIndex(i + 1)}
              className="relative block h-36 w-full"
            >
              <img src={f.url} alt={f.alt || tituloAlt} className="h-full w-full object-cover" />
              {isLast && restantes > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
                  +{restantes} fotos
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="flex h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-none bg-black/95 p-0 left-0 top-0 [&>button]:hidden">
          {openIndex !== null && (
            <Lightbox
              key={openIndex}
              fotos={fotos}
              startIndex={openIndex}
              tituloAlt={tituloAlt}
              onClose={() => setOpenIndex(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Lightbox({
  fotos,
  startIndex,
  tituloAlt,
  onClose,
}: {
  fotos: GaleriaFoto[];
  startIndex: number;
  tituloAlt: string;
  onClose: () => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(startIndex);
  const carouselDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  // Foca o próprio carrossel (não um ancestral) para que as setas do
  // teclado, capturadas pelo onKeyDownCapture interno do Carousel, funcionem
  // assim que o lightbox abre, sem precisar clicar em nada primeiro.
  useEffect(() => {
    carouselDivRef.current?.focus();
  }, []);

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
        {current + 1} / {fotos.length}
      </div>
      <Carousel
        ref={carouselDivRef}
        tabIndex={-1}
        setApi={setApi}
        opts={{ startIndex, loop: true }}
        className="mx-auto w-full max-w-5xl px-12 focus:outline-none"
      >
        <CarouselContent>
          {fotos.map((f, i) => (
            <CarouselItem key={f.url + i} className="flex items-center justify-center">
              <img
                src={f.url}
                alt={f.alt || tituloAlt}
                className="max-h-[80vh] w-full object-contain"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-0 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
        <CarouselNext className="right-0 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
      </Carousel>
    </div>
  );
}
