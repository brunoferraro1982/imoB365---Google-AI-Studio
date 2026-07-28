// Fonte única de labels de tipo/status/assinatura de contrato — antes
// duplicado em 3 arquivos (app.contratos.index.tsx, ContratoForm.tsx,
// app.contratos.painel.tsx), com risco real de ficarem fora de sincronia
// quando um enum novo era adicionado em só um dos três.

export const TIPO_LABEL: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  permuta: "Permuta",
  parceria: "Parceria",
  administracao: "Administração",
  prestacao_servico: "Prestação de Serviço",
  outro: "Outro",
};

export const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ativo: "default",
  rascunho: "secondary",
  encerrado: "outline",
  cancelado: "destructive",
};

export const ASSINATURA_INFO: Record<string, { label: string; className: string }> = {
  rascunho: {
    label: "Não enviado",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  enviado: {
    label: "Aguardando",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  assinado_parcial: {
    label: "Parcial (1/2)",
    className:
      "bg-indigo-100 text-indigo-800 animate-pulse dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  assinado_total: {
    label: "Assinado ✓",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
};

// Formato { value, label } pra popular <select> diretamente (usado por
// ContratoForm.tsx), derivado dos mesmos Records acima — nunca mais dois
// lugares pra manter em sincronia manualmente.
export const TIPOS_CONTRATO = Object.entries(TIPO_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export const STATUS_CONTRATO = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));
