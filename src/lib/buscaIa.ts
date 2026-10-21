// Ponte entre a caixa de busca por IA da home e o /buscar: a home guarda o
// pedido digitado e o que a IA entendeu; o /buscar mostra isso numa faixa.

/** Chave do sessionStorage com { pedido, resposta }. */
export const BUSCA_IA_STORAGE_KEY = "imob365:busca-ia";
