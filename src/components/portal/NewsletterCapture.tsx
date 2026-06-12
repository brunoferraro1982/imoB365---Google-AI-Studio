import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail } from "lucide-react";

interface Props {
  source?: string;
  className?: string;
}

export function NewsletterCapture({ source = "footer", className = "" }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setLoading(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email,
      source,
    } as any);
    setLoading(false);
    if (error && error.code === "23505") {
      toast.info("Você já está na nossa lista!");
      setDone(true);
      return;
    }
    if (error) {
      toast.error("Erro ao cadastrar. Tente novamente.");
      return;
    }
    toast.success("Cadastrado com sucesso! Você receberá novidades em breve.");
    setDone(true);
    setEmail("");
  }

  if (done) {
    return (
      <div className={`flex items-center gap-2 text-sm text-primary font-medium ${className}`}>
        <Mail className="h-4 w-4" />
        Cadastrado com sucesso!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <Input
        type="email"
        placeholder="Seu melhor e-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="h-9 text-sm max-w-xs"
      />
      <Button type="submit" disabled={loading} size="sm" className="h-9 font-bold shrink-0">
        {loading ? "..." : "Inscrever"}
      </Button>
    </form>
  );
}
