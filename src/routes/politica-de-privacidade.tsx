import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [{ title: "Política de Privacidade | imoB365" }],
  }),
  component: PoliticaPrivacidade,
});

function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background py-14 px-4">
      <div className="container max-w-3xl mx-auto prose prose-sm dark:prose-invert">
        <h1 className="text-2xl font-black tracking-tight mb-6">Política de Privacidade</h1>
        <p className="text-muted-foreground text-xs mb-6">Última atualização: junho de 2026</p>

        <h2>1. Coleta de Dados</h2>
        <p>A imoB365 coleta informações pessoais fornecidas voluntariamente pelos usuários ao preencher formulários de contato, cadastro ou newsletter, incluindo: nome, e-mail, telefone e dados de navegação anônimos.</p>

        <h2>2. Uso dos Dados</h2>
        <p>Os dados coletados são utilizados exclusivamente para: (a) responder solicitações de contato; (b) enviar comunicações sobre lançamentos e oportunidades imobiliárias, mediante consentimento; (c) melhorar a experiência na plataforma.</p>

        <h2>3. Compartilhamento</h2>
        <p>A imoB365 não vende, aluga ou compartilha dados pessoais com terceiros, exceto quando exigido por lei ou para viabilizar serviços contratados (provedores de infraestrutura com cláusulas de confidencialidade).</p>

        <h2>4. Seus Direitos (LGPD)</h2>
        <p>Conforme a Lei 13.709/2018 (LGPD), você tem direito a: acessar, corrigir, excluir ou solicitar a portabilidade de seus dados. Para exercer esses direitos, entre em contato pelo e-mail <a href="mailto:contato@imob365.com.br">contato@imob365.com.br</a>.</p>

        <h2>5. Cookies</h2>
        <p>Utilizamos cookies técnicos essenciais para o funcionamento da plataforma e cookies de análise (anônimos) para melhorar nossos serviços. Não utilizamos cookies de rastreamento para publicidade.</p>

        <h2>6. Segurança</h2>
        <p>Todos os dados são armazenados em servidores seguros (Supabase / Cloudflare) com criptografia em repouso e em trânsito (TLS 1.3).</p>

        <h2>7. Contato</h2>
        <p>Dúvidas sobre esta política: <a href="mailto:contato@imob365.com.br">contato@imob365.com.br</a> ou (13) 99779-4382.</p>
      </div>
    </div>
  );
}
