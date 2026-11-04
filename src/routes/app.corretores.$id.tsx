import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorPerfilCorretor } from "@/components/corretores/EditorPerfilCorretor";

export const Route = createFileRoute("/app/corretores/$id")({
  component: EditarCorretor,
});

function EditarCorretor() {
  const { id } = Route.useParams();
  return (
    <EditorPerfilCorretor
      id={id}
      voltar={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/corretores">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      }
    />
  );
}
