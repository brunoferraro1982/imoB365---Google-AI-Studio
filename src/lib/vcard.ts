// Gera e baixa um arquivo .vcf (vCard 3.0) do corretor, 100% client-side —
// sem servidor envolvido, mesmo espírito das outras utilidades puras do
// projeto (ex.: src/lib/watermark.ts). Usado tanto na página pública
// /corretor/$slug (botão "Salvar contato") quanto em /app/cartao-virtual
// (botão "Baixar meu contato").

export type VCardCorretor = {
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cargo: string | null;
  site: string | null;
  creci: string | null;
  creci_uf: string | null;
};

// Escapa caracteres reservados do formato vCard (RFC 6350) — sem isso, um
// nome ou bio com vírgula/ponto-e-vírgula quebraria o parsing no app de
// contatos de quem importar o arquivo.
function escapeVCard(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function gerarVCard(corretor: VCardCorretor, tenantNome?: string | null): string {
  const linhas = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(corretor.nome)}`,
    `N:${escapeVCard(corretor.nome)};;;;`,
  ];
  if (tenantNome) linhas.push(`ORG:${escapeVCard(tenantNome)}`);
  if (corretor.cargo) linhas.push(`TITLE:${escapeVCard(corretor.cargo)}`);
  if (corretor.whatsapp) linhas.push(`TEL;TYPE=CELL:${escapeVCard(corretor.whatsapp)}`);
  if (corretor.telefone && corretor.telefone !== corretor.whatsapp) {
    linhas.push(`TEL;TYPE=WORK:${escapeVCard(corretor.telefone)}`);
  }
  if (corretor.email) linhas.push(`EMAIL:${escapeVCard(corretor.email)}`);
  if (corretor.site) linhas.push(`URL:${escapeVCard(corretor.site)}`);
  if (corretor.creci) {
    linhas.push(
      `NOTE:CRECI ${escapeVCard(corretor.creci)}${corretor.creci_uf ? "/" + corretor.creci_uf : ""}`,
    );
  }
  linhas.push("END:VCARD");
  // CRLF é exigido pelo formato vCard (RFC 6350), não só \n.
  return linhas.join("\r\n");
}

export function baixarVCard(corretor: VCardCorretor, tenantNome?: string | null) {
  const conteudo = gerarVCard(corretor, tenantNome);
  const blob = new Blob([conteudo], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${corretor.nome.replace(/[^a-zA-Z0-9]+/g, "-")}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
