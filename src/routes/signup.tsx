import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { 
  Apple, 
  Instagram, 
  Chrome, 
  Linkedin,
  ShieldCheck, 
  Fingerprint, 
  LockKeyhole, 
  Check,
  Building2,
  Sparkles,
  CreditCard,
  QrCode,
  FileText,
  UserCheck, 
  ArrowRight,
  ArrowLeft
} from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — imob365" }] }),
  component: SignupPage,
});

type Step = 1 | 2 | 3 | 4;

const PLANS = [
  { id: "free", name: "Free", value: "Free", price: 0, desc: "Essencial para começar" },
  { id: "basic", name: "Basic", value: "basic", price: 99, desc: "Ideal para corretores individuais" },
  { id: "standard", name: "Standard", value: "standard", price: 199, desc: "Ideal para pequenas imobiliárias" },
  { id: "pro", name: "Pro", value: "pro", price: 399, desc: "Para imobiliárias em crescimento" },
  { id: "business", name: "Business", value: "business", price: 899, desc: "White-label e recursos avançados" },
];

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState<"imobiliaria" | "corretor">("imobiliaria");
  
  // Imobiliaria Fields
  const [cnpj, setCnpj] = useState("");
  const [creciJuridico, setCreciJuridico] = useState("");
  const [imobiliariaNome, setImobiliariaNome] = useState("");

  // Corretor Fields
  const [creci, setCreci] = useState("");
  const [telefone, setTelefone] = useState("");
  const [agenciaInformada, setAgenciaInformada] = useState(""); // typed name of imobiliaria

  // Plan & Payment Fields
  const [planoPretendido, setPlanoPretendido] = useState("Free");
  const [pagamentoMetodo, setPagamentoMetodo] = useState<"Pix" | "Boleto" | "Cartao">("Pix");
  const [cardNome, setCardNome] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Social Authentication simulation modal
  const [socialModal, setSocialModal] = useState<{ isOpen: boolean; provider: string } | null>(null);
  const [socialEmail, setSocialEmail] = useState("");

  async function handleSocialSignup() {
    if (!socialEmail || !socialEmail.includes("@")) {
      toast.error("Por favor, informe um e-mail válido.");
      return;
    }
    setLoading(true);
    setSocialModal(null);
    
    // Simulate auth sign up
    const randomPassword = Math.random().toString(36).slice(-10) + "Aa1!";
    const displayName = socialEmail.split("@")[0];
    const { error } = await supabase.auth.signUp({
      email: socialEmail,
      password: randomPassword,
      options: {
        data: {
          nome: displayName,
          tipo_usuario: tipoUsuario,
          plano_pretendido: planoPretendido,
          imobiliaria_nome: tipoUsuario === "corretor" ? agenciaInformada : displayName,
          aprovado: false,
          pagamento_validado: false,
          pagamento_metodo: "SocialAuth"
        }
      }
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Cadastro via ${socialModal?.provider} iniciado com sucesso! Aguarde aprovação.`);
    navigate({ to: "/login" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (step < 4 && planoPretendido !== "Free") {
      setStep((prev) => (prev + 1) as Step);
      return;
    }

    setLoading(true);
    const redirectUrl = `${window.location.origin}/app`;
    
    // Choose appropriate context
    const computedImobiliariaNome = tipoUsuario === "imobiliaria" ? (imobiliariaNome || nome) : agenciaInformada;

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { 
          nome,
          tipo_usuario: tipoUsuario,
          plano_pretendido: planoPretendido,
          imobiliaria_nome: computedImobiliariaNome,
          aprovado: false,
          pagamento_validado: false,
          pagamento_metodo: planoPretendido === "Free" ? "Isento" : pagamentoMetodo,
          creci: tipoUsuario === "corretor" ? creci : creciJuridico,
          telefone: telefone,
          cnpj: cnpj
        },
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Try to execute a fallback write in profiles table directly to guarantee database sync
    if (signUpData?.user) {
      try {
        await supabase.from("profiles").update({
          tipo_usuario: tipoUsuario,
          plano_pretendido: planoPretendido,
          imobiliaria_nome: computedImobiliariaNome,
          aprovado: false,
          pagamento_validado: false,
          pagamento_metodo: planoPretendido === "Free" ? "Isento" : pagamentoMetodo,
          telefone: telefone || null
        } as any).eq("id", signUpData.user.id);
      } catch (e) {
        console.warn("Direct profile update skipped (using trigger instead)", e);
      }
    }

    setLoading(false);
    toast.success("Cadastro recebido! Sua conta foi enviada para aprovação do Super Admin.");
    navigate({ to: "/login" });
  }

  const selectedPlanObj = PLANS.find(p => p.value === planoPretendido) || PLANS[0];

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12 relative font-sans">
      
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block"><Logo className="h-7 w-auto" /></Link>
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <span 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${step === s ? "w-8 bg-primary" : "w-1.5 bg-muted"}`} 
              />
            ))}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {step === 1 && "Criar sua conta"}
            {step === 2 && "Configure seu perfil"}
            {step === 3 && "Selecione seu plano"}
            {step === 4 && "Validação de Pagamento"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 1 && "Preencha seus dados de acesso iniciais."}
            {step === 2 && "Insira as credenciais profissionais de atuação."}
            {step === 3 && "Escolha quanto sua operação precisa crescer."}
            {step === 4 && `Demonstração do pagamento de R$ ${selectedPlanObj.price}/mês`}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* STEP 1: LOGIN DETAILS */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-muted/60">
                <button
                  type="button"
                  onClick={() => setTipoUsuario("imobiliaria")}
                  className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg text-sm font-semibold transition border border-transparent ${tipoUsuario === "imobiliaria" ? "bg-card shadow-sm border-border text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Building2 className="h-4 w-4 mb-1" />
                  Imobiliária
                </button>
                <button
                  type="button"
                  onClick={() => setTipoUsuario("corretor")}
                  className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg text-sm font-semibold transition border border-transparent ${tipoUsuario === "corretor" ? "bg-card shadow-sm border-border text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <UserCheck className="h-4 w-4 mb-1" />
                  Corretor
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail de Trabalho</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha de Acesso</Label>
                <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
              </div>

              {/* SOCIAL LOGINS */}
              <div className="pt-2">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou cadastre-se via rede social</span></div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="p-2 h-10 w-full"
                    onClick={() => { setSocialModal({ isOpen: true, provider: "Google" }); setSocialEmail(email); }}
                  >
                    <Chrome className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="p-2 h-10 w-full"
                    onClick={() => { setSocialModal({ isOpen: true, provider: "Instagram" }); setSocialEmail(email); }}
                  >
                    <Instagram className="h-4 w-4 text-pink-600" />
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="p-2 h-10 w-full"
                    onClick={() => { setSocialModal({ isOpen: true, provider: "LinkedIn" }); setSocialEmail(email); }}
                  >
                    <Linkedin className="h-4 w-4 text-blue-700" />
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="p-2 h-10 w-full"
                    onClick={() => { setSocialModal({ isOpen: true, provider: "Apple" }); setSocialEmail(email); }}
                  >
                    <Apple className="h-4 w-4 text-foreground" />
                  </Button>
                </div>
              </div>

              <Button type="button" onClick={() => {
                if (!nome || !email || !password) {
                  toast.error("Por favor, preencha todos os campos.");
                  return;
                }
                setStep(2);
              }} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
                Próximo passo <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}

          {/* STEP 2: PROFESSIONAL ATTRIBUTES */}
          {step === 2 && (
            <div className="space-y-4">
              {tipoUsuario === "imobiliaria" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="imobiliariaNome">Nome Fantasia da Imobiliária</Label>
                    <Input id="imobiliariaNome" required value={imobiliariaNome} onChange={(e) => setImobiliariaNome(e.target.value)} placeholder="Ex: Imobiliária Alvorada" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ da Empresa</Label>
                    <Input id="cnpj" required value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creciJuridico">CRECI Jurídico (PJ)</Label>
                    <Input id="creciJuridico" required value={creciJuridico} onChange={(e) => setCreciJuridico(e.target.value)} placeholder="CRECI 12345-J" />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="creci">Seu CRECI (PF)</Label>
                    <Input id="creci" required value={creci} onChange={(e) => setCreci(e.target.value)} placeholder="Ex: CRECI 67890-F" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">WhatsApp / Celular</Label>
                    <Input id="telefone" required value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-2 border border-border/80 rounded-xl p-4 bg-muted/20">
                    <Label htmlFor="agenciaInformada" className="text-primary font-semibold block mb-1">Qual é a sua imobiliária de atuação?</Label>
                    <p className="text-xs text-muted-foreground mb-2">Por determinação da LGPD, digite o nome da imobiliária onde você atua diretamente para que o Super-admin faça a vinculação interna segura.</p>
                    <Input id="agenciaInformada" value={agenciaInformada} onChange={(e) => setAgenciaInformada(e.target.value)} placeholder="Pesquisar/escrever nome da imobiliária..." />
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
                </Button>
                <Button type="button" onClick={() => {
                  if (tipoUsuario === "imobiliaria" && (!imobiliariaNome || !cnpj || !creciJuridico)) {
                    toast.error("Por favor, preencha as informações profissionais.");
                    return;
                  }
                  if (tipoUsuario === "corretor" && (!creci || !telefone)) {
                    toast.error("Por favor, preencha Creci e WhatsApp.");
                    return;
                  }
                  setStep(3);
                }} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  Planos <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PLAY SELECTION */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3.5 max-h-[360px] overflow-y-auto pr-1">
                {PLANS.map((p) => {
                  const check = planoPretendido === p.value;
                  return (
                    <div 
                      key={p.id}
                      onClick={() => setPlanoPretendido(p.value)}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${check ? "border-primary bg-primary/5 ring-1 ring-primary/25" : "border-border hover:border-muted-foreground/30 bg-card"}`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{p.name}</span>
                          {p.price > 0 && <span className="inline-flex items-center rounded-full bg-accent/80 px-1.5 py-0.5 text-3xs font-medium text-accent-foreground font-mono">Mensal</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.desc}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-sm">{p.price === 0 ? "Grátis" : `R$ ${p.price}/mês`}</div>
                        {check && <Check className="h-4 w-4 text-primary ml-auto mt-1" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (planoPretendido === "Free") {
                      // Skip payment step and register directly
                      setLoading(true);
                      onSubmit(new Event('submit') as any);
                    } else {
                      setStep(4);
                    }
                  }} 
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {planoPretendido === "Free" ? "Concluir Cadastro" : "Ir para o Pagamento"} <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: PAYMENT VALIDATOR DEMO */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 bg-muted/15 flex flex-col items-center justify-center text-center">
                <Sparkles className="h-5 w-5 text-yellow-500 mb-1" />
                <span className="text-xs uppercase text-muted-foreground font-semibold">Valor Recorrente</span>
                <span className="text-xl font-bold font-mono">R$ {selectedPlanObj.price},00 / mês</span>
                <span className="text-xs text-primary mt-1">Plano Pretendido: Plano {selectedPlanObj.name}</span>
              </div>

              {/* PAYMENT METHOD SELECTOR */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPagamentoMetodo("Pix")}
                  className={`flex flex-col items-center py-2 px-1 border-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${pagamentoMetodo === "Pix" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                >
                  <QrCode className="h-4 w-4 mb-1" />
                  PIX Instantâneo
                </button>
                <button
                  type="button"
                  onClick={() => setPagamentoMetodo("Boleto")}
                  className={`flex flex-col items-center py-2 px-1 border-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${pagamentoMetodo === "Boleto" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                >
                  <FileText className="h-4 w-4 mb-1" />
                  Boleto Bancário
                </button>
                <button
                  type="button"
                  onClick={() => setPagamentoMetodo("Cartao")}
                  className={`flex flex-col items-center py-2 px-1 border-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${pagamentoMetodo === "Cartao" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                >
                  <CreditCard className="h-4 w-4 mb-1" />
                  Cartão de Crédito
                </button>
              </div>

              {/* PIX VIEW */}
              {pagamentoMetodo === "Pix" && (
                <div className="flex flex-col items-center border border-border rounded-xl p-4 bg-muted/10">
                  <div className="w-32 h-32 bg-card border-2 border-primary rounded-xl flex items-center justify-center p-2 mb-3">
                    <QrCode className="h-28 w-28 text-foreground" />
                  </div>
                  <p className="text-2xs text-muted-foreground text-center">Escaneie o QR Code acima pelo app do seu banco ou use a chave Copia e Cola abaixo para preencher o pagamento:</p>
                  <div className="flex w-full mt-3 gap-1.5">
                    <Input readOnly value="00020101021226870014br.gov.bcb.pix2565imob365-cadastro-validation" className="font-mono text-3xs h-8 bg-card" />
                    <Button type="button" size="sm" className="h-8" onClick={() => toast.success("Código Pix copiado!")}>Copiar</Button>
                  </div>
                </div>
              )}

              {/* BOLETO VIEW */}
              {pagamentoMetodo === "Boleto" && (
                <div className="flex flex-col items-center border border-border rounded-xl p-4 bg-muted/10">
                  <FileText className="h-10 w-10 text-muted-foreground mb-1" />
                  <p className="text-2xs text-muted-foreground text-center font-semibold text-primary">Boleto Bancário Gerado com Sucesso</p>
                  <p className="text-3xs text-muted-foreground text-center mt-1">O boleto possui validade de 3 dias úteis para pagamento.</p>
                  <div className="flex w-full mt-3 gap-1.5">
                    <Input readOnly value="34191.79001 01043.513184 91020.150008 7 98200000019900" className="font-mono text-3xs h-8 bg-card" />
                    <Button type="button" size="sm" className="h-8" onClick={() => toast.success("Código de Barras copiado!")}>Copiar</Button>
                  </div>
                </div>
              )}

              {/* CREDIT CARD VIEW */}
              {pagamentoMetodo === "Cartao" && (
                <div className="space-y-2.5 border border-border rounded-xl p-4 bg-muted/10 text-left">
                  <div className="space-y-1">
                    <Label htmlFor="cardNome" className="text-3xs font-semibold uppercase">Nome do Titular (Como no cartão)</Label>
                    <Input id="cardNome" required value={cardNome} onChange={(e) => setCardNome(e.target.value)} placeholder="JOÃO S SILVA" className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cardNumber" className="text-3xs font-semibold uppercase">Número do Cartão</Label>
                    <Input id="cardNumber" required value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" className="h-8 text-xs font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="cardExpiry" className="text-3xs font-semibold uppercase">Validade</Label>
                      <Input id="cardExpiry" required value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/AA" className="h-8 text-xs font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cardCvv" className="text-3xs font-semibold uppercase">CVV</Label>
                      <Input id="cardCvv" required value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="000" className="h-8 text-xs font-mono" />
                    </div>
                  </div>
                </div>
              )}

              <div className="text-3xs bg-primary/10 border border-primary/20 text-primary p-2.5 rounded-lg flex items-center justify-center gap-1.5 text-center font-semibold">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
                DADOS DE SEÇÃO INTEGRADA AMBIENTE DE DEMONSTRAÇÃO E SEGURO.
              </div>

              <div className="flex gap-3 mt-4">
                <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {loading ? "Concluindo..." : "Concluir Cadastro"} <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground font-sans">
          Já tem conta? <Link to="/login" className="text-primary hover:underline font-semibold">Entrar</Link>
        </p>
      </div>

      {/* SOCIALAUTH DIALOG SIMULATOR */}
      {socialModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight mb-2">Continuar com {socialModal.provider}</h3>
            <p className="text-xs text-muted-foreground mb-4">Insira seu e-mail para conectar sua conta social via credencial simulada do {socialModal.provider}:</p>
            
            <div className="space-y-3.5 text-left">
              <div>
                <Label htmlFor="socialEmail" className="text-xs font-medium mb-1 block">Seu E-mail</Label>
                <Input 
                  id="socialEmail" 
                  type="email" 
                  value={socialEmail}
                  onChange={(e) => setSocialEmail(e.target.value)}
                  placeholder="nome@social.com" 
                  required 
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setSocialModal(null)}>Cancelar</Button>
                <Button type="button" className="flex-1" onClick={handleSocialSignup}>Sim, conectar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
