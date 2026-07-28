// Fonte única de labels da Central de Atendimento — mesmo padrão de
// contratosLabels.ts (evita duplicar o mesmo Record em cada tela que
// listar/filtrar chamados).

export const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  novo: "destructive",
  em_atendimento: "default",
  aguardando_cliente: "secondary",
  resolvido: "outline",
  fechado: "outline",
};

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  baixa: "secondary",
  media: "outline",
  alta: "default",
  urgente: "destructive",
};

export const CATEGORIA_LABEL: Record<string, string> = {
  problema_plataforma: "Problema na plataforma",
  duvida_comercial: "Dúvida comercial",
  reclamacao_anuncio: "Reclamação sobre anúncio",
  financeiro_cobranca: "Financeiro / cobrança",
  outro: "Outro",
};

export const CANAL_LABEL: Record<string, string> = {
  web_chat: "Chat do site",
  web_formulario: "Formulário",
  email: "E-mail",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

export const RESPONSAVEL_LABEL: Record<string, string> = {
  imob365: "imoB365 (suporte da plataforma)",
  tenant: "Imobiliária / corretor",
};

// Formato { value, label } pra popular <select> diretamente.
export const STATUS_CHAMADO = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
export const PRIORIDADE_CHAMADO = Object.entries(PRIORIDADE_LABEL).map(([value, label]) => ({
  value,
  label,
}));
export const CATEGORIA_CHAMADO = Object.entries(CATEGORIA_LABEL).map(([value, label]) => ({
  value,
  label,
}));
